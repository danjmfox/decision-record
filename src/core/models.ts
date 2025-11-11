export type DecisionStatus =
  | "new"
  | "draft"
  | "proposed"
  | "accepted"
  | "deprecated"
  | "superseded"
  | "rejected"
  | "retired"
  | "archived";

export type ChangeType =
  | "creation"
  | "correction"
  | "revision"
  | "supersession"
  | "retirement";

export type ReviewType = "scheduled" | "adhoc" | "contextual";

export type ReviewOutcome = "keep" | "revise" | "retire" | "supersede";

export interface ReviewHistoryEntry {
  date: string;
  type: ReviewType;
  outcome: ReviewOutcome;
  reviewer?: string;
  reason?: string;
}

export interface ChangelogEntry {
  date: string;
  note: string;
}

export interface DecisionRecord {
  id: string;
  dateCreated: string;
  lastEdited?: string;
  lastReviewedAt?: string;
  dateAccepted?: string;
  version: string;
  status: DecisionStatus;
  changeType: ChangeType;
  changelog?: ChangelogEntry[];
  confidence?: number;
  reviewDate?: string;
  reviewHistory?: ReviewHistoryEntry[];
  domain: string;
  slug: string;
  supersedes?: string | null;
  supersededBy?: string | null;
  tags?: string[];
  templateUsed?: string;
}
