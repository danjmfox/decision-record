import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const metaDir = path.resolve("decisions-example/meta");

const PLACEHOLDERS = [
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

const TEMPLATE_HEADINGS = [
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

describe("decision record hygiene", () => {
  const files = fs.readdirSync(metaDir).filter((file) => file.endsWith(".md"));

  for (const file of files) {
    const filePath = path.join(metaDir, file);
    const content = fs.readFileSync(filePath, "utf8");

    it(`${file} has no template placeholder text`, () => {
      for (const placeholder of PLACEHOLDERS) {
        expect(content.includes(placeholder)).toBeFalsy();
      }
    });

    it(`${file} does not duplicate template headings`, () => {
      for (const heading of TEMPLATE_HEADINGS) {
        const occurrences = content.split(heading).length - 1;
        expect(occurrences).toBeLessThanOrEqual(1);
      }
    });
  }
});
