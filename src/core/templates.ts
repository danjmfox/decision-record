import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import type { DecisionRecord } from "./models.js";
import type { RepoContext } from "../config.js";
import type { CreateDecisionOptions, RepoOptions } from "./service-types.js";
import { getDecisionPath } from "./repository.js";

interface ResolvedTemplate {
  body: string;
  templateUsed?: string;
}

interface TemplateCandidateResolution {
  absolutePath: string;
  templateId: string;
}

const DEFAULT_TEMPLATE_LINES = [
  "## 🧭 Context",
  "",
  "_Describe the background and circumstances leading to this decision._",
  "",
  "## ⚖️ Options Considered",
  "",
  "_List the main options or alternatives that were evaluated before making the decision, including why each was accepted or rejected._",
  "",
  "| Option | Description | Outcome  | Rationale                      |",
  "| ------ | ----------- | -------- | ------------------------------ |",
  "| A      | Do nothing  | Rejected | Insufficient long-term clarity |",
  "| B      |             |          |                                |",
  "",
  "## 🧠 Decision",
  "",
  "_State the decision made clearly and succinctly._",
  "",
  "## 🪶 Principles",
  "",
  "_List the guiding principles or values that influenced this decision._",
  "",
  "## 🔁 Lifecycle",
  "",
  "_Outline the current lifecycle state and any relevant change types._",
  "",
  "## 🧩 Reasoning",
  "",
  "_Explain the rationale, trade-offs, and considerations behind the decision._",
  "",
  "## 🔄 Next Actions",
  "",
  "_Specify the immediate next steps or actions following this decision._",
  "",
  "## 🧠 Confidence",
  "",
  "_Indicate the confidence level in this decision and any planned reviews._",
  "",
  "## 🧾 Changelog",
  "",
  "_Summarise notable updates, revisions, or corrections. Each should have a date and note in YAML frontmatter for traceability._",
  "",
];

const DEFAULT_PLACEHOLDER_LINES = [
  "_Describe the background and circumstances leading to this decision._",
  "_List the main options or alternatives that were evaluated before making the decision, including why each was accepted or rejected._",
  "_State the decision made clearly and succinctly._",
  "_List the guiding principles or values that influenced this decision._",
  "_Outline the current lifecycle state and any relevant change types._",
  "_Explain the rationale, trade-offs, and considerations behind the decision._",
  "_Specify the immediate next steps or actions following this decision._",
  "_Indicate the confidence level in this decision and any planned reviews._",
  "_Summarise notable updates, revisions, or corrections. Each should have a date and note in YAML frontmatter for traceability._",
];

const DEFAULT_REQUIRED_HEADINGS = [
  "## 🧭 Context",
  "## ⚖️ Options Considered",
  "## 🧠 Decision",
  "## 🪶 Principles",
  "## 🔁 Lifecycle",
  "## 🧩 Reasoning",
  "## 🔄 Next Actions",
  "## 🧠 Confidence",
  "## 🧾 Changelog",
];

const OPTIONS_PLACEHOLDER_REGEX = /\| B\s+\|\s+\|\s+\|\s+\|/;

export function resolveTemplateBody(
  record: DecisionRecord,
  context: RepoContext,
  options: CreateDecisionOptions,
): ResolvedTemplate {
  const candidates = [
    sanitizeTemplateCandidate(options.templatePath),
    sanitizeTemplateCandidate(
      options.envTemplate ?? process.env.DRCTL_TEMPLATE,
    ),
    sanitizeTemplateCandidate(context.defaultTemplate),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = resolveTemplateCandidate(context, candidate);
    if (!resolved) continue;
    if (!fs.existsSync(resolved.absolutePath)) continue;
    try {
      const stats = fs.statSync(resolved.absolutePath);
      if (!stats.isFile()) continue;
    } catch {
      continue;
    }
    try {
      const body = fs.readFileSync(resolved.absolutePath, "utf8");
      const templateUsed = ensureTemplateInRepo(context, resolved, body);
      return { body, templateUsed };
    } catch {
      continue;
    }
  }
  return { body: renderTemplate(record) };
}

export function emitTemplateWarnings(
  context: RepoContext,
  record: DecisionRecord,
  options: RepoOptions,
): void {
  const warnings = collectTemplateWarnings(context, record);
  if (warnings.length === 0) return;
  const handler =
    typeof options.onTemplateWarning === "function"
      ? options.onTemplateWarning
      : (message: string) => {
          console.warn(`⚠️ ${message}`);
        };
  for (const warning of warnings) {
    handler(`Template hygiene: ${warning}`);
  }
}

function sanitizeTemplateCandidate(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function resolveTemplateCandidate(
  context: RepoContext,
  candidate: string,
): TemplateCandidateResolution | undefined {
  const expanded = expandHome(candidate);
  const absolutePath = path.isAbsolute(expanded)
    ? path.normalize(expanded)
    : path.resolve(context.root, expanded);
  const templateId = deriveTemplateId(context.root, candidate, absolutePath);
  return { absolutePath, templateId };
}

function expandHome(input: string): string {
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

function deriveTemplateId(
  repoRoot: string,
  original: string,
  absolutePath: string,
): string {
  if (!path.isAbsolute(original)) {
    return normalizeToPosix(original);
  }
  const relative = path.relative(repoRoot, absolutePath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return normalizeToPosix(relative);
  }
  return normalizeToPosix(original);
}

function normalizeToPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function ensureTemplateInRepo(
  context: RepoContext,
  resolved: TemplateCandidateResolution,
  body: string,
): string {
  const relative = path.relative(context.root, resolved.absolutePath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return normalizeToPosix(relative);
  }

  const templatesDir = path.join(context.root, "templates");
  fs.mkdirSync(templatesDir, { recursive: true });

  const sourceContent = body;
  const { name, ext } = path.parse(resolved.absolutePath);
  let candidateName = `${name}${ext}`;
  let targetPath = path.join(templatesDir, candidateName);

  if (fs.existsSync(targetPath)) {
    const existing = fs.readFileSync(targetPath, "utf8");
    if (existing === sourceContent) {
      return normalizeToPosix(path.relative(context.root, targetPath));
    }
    let counter = 2;
    while (true) {
      candidateName = `${name}-${counter}${ext}`;
      targetPath = path.join(templatesDir, candidateName);
      if (!fs.existsSync(targetPath)) {
        break;
      }
      counter += 1;
    }
  }

  fs.writeFileSync(targetPath, sourceContent, "utf8");
  return normalizeToPosix(path.relative(context.root, targetPath));
}

function renderTemplate(record: DecisionRecord): string {
  return [`# ${record.id}`, "", ...DEFAULT_TEMPLATE_LINES].join("\n");
}

function collectTemplateWarnings(
  context: RepoContext,
  record: DecisionRecord,
): string[] {
  const warnings: string[] = [];
  const filePath = getDecisionPath(context, record);
  if (!fs.existsSync(filePath)) {
    return warnings;
  }
  const { content } = matter.read(filePath);

  if (DEFAULT_PLACEHOLDER_LINES.some((line) => content.includes(line))) {
    warnings.push(
      "Placeholder text from the default template is still present.",
    );
  }

  if (!record.templateUsed) {
    const missingHeadings = DEFAULT_REQUIRED_HEADINGS.filter(
      (heading) => !headingExists(content, heading),
    );
    if (missingHeadings.length > 0) {
      warnings.push(
        `Missing default template heading(s): ${missingHeadings.join(", ")}.`,
      );
    }
  }

  if (OPTIONS_PLACEHOLDER_REGEX.test(content)) {
    warnings.push("The options table still contains placeholder rows.");
  }

  return warnings;
}

function headingExists(content: string, heading: string): boolean {
  const pattern = new RegExp(`^${escapeRegExp(heading)}\\s*$`, "m");
  return pattern.test(content);
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
