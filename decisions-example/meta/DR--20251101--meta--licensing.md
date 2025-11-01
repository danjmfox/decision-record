---
id: DR--20251101--meta--licensing
dateCreated: "2025-11-01"
version: "1.0"
status: accepted
changeType: creation
domain: meta
slug: licensing
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
  - date: "2025-11-01"
    note: Marked as accepted
lastEdited: "2025-11-01"
dateAccepted: "2025-11-01"
---

# DR--20251101--meta--licensing

## 🧭 Context

We need a permissive licence so others can use the CLI, while keeping open the option to monetise hosted services or proprietary extensions. Creative Commons licences are tailored to content rather than software and typically discourage or complicate commercial reuse of code. We also want a prominent, explicit no-liability statement.

## ⚖️ Options Considered

| Option                        | Description                                  | Outcome    | Rationale                                                                                       |
| ----------------------------- | -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| Creative Commons (BY/NC/etc.) | Apply a CC licence to the repo               | Rejected   | CC is not recommended for software; NC clauses conflict with monetisation goals.                |
| Apache 2.0                    | Use Apache 2.0 software licence              | Considered | Provides patent grant and explicit liability limits but longer/complex; overkill for small CLI. |
| MIT (chosen)                  | Adopt MIT licence with reinforced disclaimer | Accepted   | Widely understood, permits commercial use, simple to incorporate custom no-liability wording.   |

## 🧠 Decision

Use the MIT licence for this repository, augmented with a clearly worded “No Liability Disclaimer” section while retaining the standard MIT text for compatibility. This keeps the project open-source friendly, allows future commercial offerings, and makes the liability stance explicit.

## 🪶 Principles

- **Openness with optional monetisation** – keep usage flexible for community and commercial contexts.
- **Clarity** – state the liability disclaimer prominently while remaining MIT-compatible.
- **Compatibility** – rely on a licence familiar to open-source consumers and tooling.

## 🔁 Lifecycle

Status: `accepted`. Future revisions will bump the version if licensing terms change.

## 🧩 Reasoning

MIT’s simplicity aligns with the project’s goals: it enables redistribution and modification, includes a permissive warranty disclaimer, and is familiar to developers. Creative Commons licences are ill-suited for code and could block downstream usage. Apache 2.0 was considered but its length/patent clauses felt unnecessary. Adding an explicit no-liability section above the standard MIT text reinforces expectations while preserving legal compatibility.

## 🔄 Next Actions

- None. Monitor for future legal guidance or licence changes.

## 🧠 Confidence

High – MIT is a well-established default for permissive software projects.

## 🧾 Changelog

- 2025-11-01 — Initial draft.
- 2025-11-01 — Accepted with MIT licence published.
