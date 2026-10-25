---
name: implementation-plan
description: Author an Implementation Plan for .NET engineering tasks in standard format (findings, affected files, options with pros/cons, Unit Test and Tech Doc impact, estimates) for user review and approval prior to coding. Use at the beginning of every task, whether files are known upfront (Mode A) or only business flow/issues are described (Mode B).
---

# Implementation Plan

The plan is a basis for discussion and decision-making, not a mere formality. The user makes decisions based on this document, so it must be honest, specific, and traceable to the codebase. Use `templates/implementation-plan.md` as the skeleton and persist it at `.office/tasks/<id>/plan.md`.

## Mode A - Known Files
1. Read the files referenced by the user. Trace callers and dependencies (`grep` class/method names) to surface unmentioned impacts.
2. Restate the task in your own words (one concise paragraph) so misunderstandings are caught early.

## Mode B - Business Flow / Trace Issue
1. Identify the entry point (endpoint, message consumer, background job). Trace execution flow down to Services, Repositories, and database tables.
2. Gather evidence in `path:line` format. Strictly separate **Facts** from **Hypotheses**; assign confidence levels (high/medium/low).
3. If root cause cannot yet be determined with certainty, state so clearly and propose verification steps (logs, read-only queries, reproduction test). Do not force a solution on top of unverified assumptions.

## Plan Structure (Fixed Order)
1. **Task Summary** and mode (Mode A / Mode B).
2. **Findings**: current flow, root cause or architectural gap, concrete evidence.
3. **Scope of Changes**: table of `File | Class/Method | Action (modify/add/delete) | Rationale`.
4. **Solution Options**: at least 2 options when a real design decision exists. For each option: technical approach, **Pros**, **Cons**, risks, and estimate (mandays; 1 manday = 9 work hours, increments of 0.25, aligned with `jira-task-generator`). If only one approach is genuinely feasible, justify why instead of inventing false comparisons. Conclude with **Recommendation** and rationale.
5. **Impacts**:
   - Database: entities/columns/indexes/migrations (whether a *Database Changes Query* is required in the PR), existing data compatibility.
   - API contract (breaking changes?), messaging (topics/exchanges), background jobs, configuration/environment variables, performance, backward compatibility.
6. **Unit Test Impact** (Mandatory if project has a test project):
   - Existing affected tests (path + class name) and necessary adjustments.
   - New test scenarios per modified function: happy path, negative cases, edge cases. Per scenario specify: seeded test data, tables/fields to assert, expected response, external clients to mock.
   - If no test project exists: explicitly note it and ask if the user wants test projects set up.
7. **Documentation Impact**: affected Tech Doc pages (API Contract, Business Logic, Kafka/Queue, RabbitMQ/Queue, Background Process, Data Model, Integration, Config, Frontend/UI) and whether this is a new feature (triggers RFC prompt). Note: all Tech Doc & RFC updates must be written in English.
8. **Branch**: user-provided branch name, status (new/existing), base branch.
9. **Open Questions** and underlying assumptions.
10. **Decision Required**: clear concluding action prompt, e.g. `Reply "approve option A" / request revision / cancel`.

## Quality Guidelines
- Be specific: cite exact class names, methods, and database tables. Avoid vague phrases like "fix the logic".
- Detail Cons rigorously, including for the recommended option.
- Do not start modifying code. The plan is the sole output of this phase.
- Keep it concise: a great plan can be reviewed by an engineer in 3 minutes. Extended details belong in an appendix at the end.
