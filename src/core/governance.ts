import type { RepoContext } from "../config.js";
import type { DecisionWithSource } from "./service.js";
import { collectDecisions } from "./service.js";
import { validateDecisions, type ValidationIssue } from "./validation.js";

export interface RepositoryValidationIssue extends ValidationIssue {
  filePath?: string | null;
}

export function validateRepository(
  context: RepoContext,
): RepositoryValidationIssue[] {
  const decisions: DecisionWithSource[] = collectDecisions(context);
  const issues = validateDecisions(
    decisions.map((entry) => entry.record),
    {
      scope: "repo",
      repoName: context.name ?? "(unnamed)",
    },
  );

  return issues.map((issue) => {
    const source = decisions.find(
      (entry) => entry.record.id === issue.recordId,
    );
    return {
      ...issue,
      filePath: source?.filePath ?? null,
    };
  });
}
