---
id: "{{ id }}"
dateCreated: "{{ dateCreated }}"
lastEdited: "{{ lastEdited }}"
version: "{{ version }}"
status: "{{ status }}"
changeType: "{{ changeType }}"
changelog:
  - date: "{{ changeDate }}"
    note: "{{ changeNote }}"
confidence: "{{ confidence }}"
reviewDate: "{{ reviewDate }}"
domain: "{{ domain }}"
slug: "{{ slug }}"
supersedes: "{{ supersedes }}"
supersededBy: "{{ supersededBy }}"
tags: "{{ tags }}"
---

# {{name}} {{id}}

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
