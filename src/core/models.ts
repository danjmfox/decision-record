export type DecisionStatus =
  | "proposed"
  | "accepted"
  | "deprecated"
  | "superseded"
  | "retired"
  | "archived";

export type ChangeType =
  | "creation"
  | "correction"
  | "revision"
  | "supersession"
  | "retirement";

export interface ChangelogEntry {
  date: string;
  note: string;
}

export interface DecisionRecord {
  id: string;
  dateCreated: string;
  lastEdited?: string;
  version: string;
  status: DecisionStatus;
  changeType: ChangeType;
  changelog?: ChangelogEntry[];
  confidence?: number;
  reviewDate?: string;
  domain: string;
  slug: string;
  supersedes?: string | null;
  supersededBy?: string | null;
  tags?: string[];
}
