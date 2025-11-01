---
id: DR--20251101--meta--licensing
dateCreated: "2025-11-01"
version: "1.0"
status: draft
changeType: creation
domain: meta
slug: licensing
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
lastEdited: "2025-11-01"
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

Status: `draft`. Promote once the licence file is added and referenced in docs.

## 🧩 Reasoning

MIT’s simplicity aligns with the project’s goals: it enables redistribution and modification, includes a permissive warranty disclaimer, and is familiar to developers. Creative Commons licences are ill-suited for code and could block downstream usage. Apache 2.0 was considered but its length/patent clauses felt unnecessary. Adding an explicit no-liability section above the standard MIT text reinforces expectations while preserving legal compatibility.

## 🔄 Next Actions

- Add `LICENSE.md` with the MIT licence and custom disclaimer.
- Reference the licence in README/AGENTS once added.
- Promote this DR to `proposed`/`accepted` after review.

## 🧠 Confidence

High – MIT is a well-established default for permissive software projects.

## 🧾 Changelog

- 2025-11-01 — Initial draft.

# DR--20251101--meta--licensing

## 🧭 Context

_Describe the background and circumstances leading to this decision._

## ⚖️ Options Considered

_List the main options or alternatives that were evaluated before making the decision, including why each was accepted or rejected._

| Option | Description | Outcome  | Rationale                      |
| ------ | ----------- | -------- | ------------------------------ |
| A      | Do nothing  | Rejected | Insufficient long-term clarity |
| B      |             |          |                                |

## 🧠 Decision

_State the decision made clearly and succinctly._

## 🪶 Principles

_List the guiding principles or values that influenced this decision._

## 🔁 Lifecycle

_Outline the current lifecycle state and any relevant change types._

## 🧩 Reasoning

_Explain the rationale, trade-offs, and considerations behind the decision._

## 🔄 Next Actions

_Specify the immediate next steps or actions following this decision._

## 🧠 Confidence

_Indicate the confidence level in this decision and any planned reviews._

## 🧾 Changelog

_Summarise notable updates, revisions, or corrections. Each should have a date and note in YAML frontmatter for traceability._
