---
name: docs-sync
description: Mandatory documentation workflow for every task in this office - searching for existing RFCs in Strand/Docmost, deciding whether to create an RFC (new features only and with explicit user approval), and updating Tech Docs (draft, review at Gate 2, then write via MCP). Use as a wrapper for tech-doc-generator and docmost-rfc-generator skills.
---

# Docs Sync

This skill governs **when and in what order** documentation is created. The content format adheres strictly to `tech-doc-generator` (Tech Docs) and `docmost-rfc-generator` (RFCs).

> [!IMPORTANT]
> **Language Mandate:** All documentation (Tech Docs, RFCs, and Changelogs) drafted and published to Strand/Docmost via MCP **MUST be written in English**.

## A. RFC (Only when task = new feature)
1. Search first via MCP (`search_pages`): feature name, service name, "RFC". Retrieve title, status, and URL link.
2. The Office Manager asks the user (in a single message, including search results):
   - Is an RFC needed or not?
   - Does an existing RFC already cover this? (show candidates from search results)
3. Decision outcomes:
   | User Decision | Action |
   |---|---|
   | RFC already exists | Link it in the plan and Changelog. If implementation design deviates from the RFC, propose updating the RFC and await approval. |
   | None exists & needed | After Gate 1, create a `DRAFT` RFC following `docmost-rfc-generator` in English (Mermaid diagrams mandatory, GFM tables). RFC number format `RFC-YYYY-NNN`: find the latest RFC number and increment by +1. Save under `rfc_parent_page_id`. |
   | Not needed | Record "RFC skipped per user decision" in `brief.md`. |
4. Never create an RFC without an explicit "yes" from the user. Any RFC content that cannot be deduced from the plan/code must be written as `Needs confirmation`, never fabricated.

## B. Tech Doc (Mandatory for every task)
1. **Determine scope** (Step 1 and 1b of Tech Doc skill): identify which service, check if the Service Tech Doc page exists (`search_pages`).
   - If no Service Tech Doc page exists yet for this service: do not generate the entire Tech Doc silently. Ask the user: generate full tech doc (separate task) or only pages for affected components.
2. **Classify changes** from `git diff <merge-base>..HEAD --name-only` to component types using Step 2 signals (Controller -> API Contract, `*Business.cs` -> Business Logic, `*Consumer/Handler` -> Kafka/Queue, `EventHelper` -> RabbitMQ/Queue, `HangfireJobScheduler` -> Background Process, Entity/Migration -> Data Model, Refit/HttpClient -> Integration, `appsettings`/`AppConfig` -> Config, UI routes -> Frontend/UI).
3. **Fetch templates** for entries (`get_template`) for each affected component. Template IDs are listed in `office-config/platform-notes.md`.
4. **Draft** into `.office/tasks/<id>/docs-draft.md` in English: new/modified entries using the template field structure, mandatory Source (path + line range), and real schema in code blocks (no placeholders). Data Model: ERD and table descriptions must match. Add one **Changelog** row (date, version from csproj `<Version>` or `git describe --tags --abbrev=0`, change summary, touched pages, RFC/PR link if applicable; leave version blank if no git tag exists, do not fabricate).
5. **Gate 2**: present the draft to the user alongside the diff and test results.
6. **Write** after approval: call `get_page` to obtain UUID, then `update_page`/`create_page`/`create_page_from_template`. Patch only modified entries; never overwrite manually edited content. Entry-type: append/modify entries; Bulk-type (Data Model, Config): edit only relevant tables/rows.
7. **Cross-link** to other services' Tech Docs instead of duplicating details (Step 5 of Tech Doc skill).

## C. Failure Conditions & Guardrails
- MCP unreachable or rejected: set status to `blocked`, report to user. Do not mark documentation as complete; keep the PR checklist item "updated the documentation" as `[ ]`.
- Target page not found or ID differs from notes: re-search via `search_pages`/`list_pages`, do not guess IDs.
- No components affected (e.g. test-only changes or internal refactoring): still add a Changelog row and explain the reason to the user.
- Documentation must never contain secrets, connection strings, passwords, or personal data (PII).
- **All drafted and published pages in Docmost must be in English.**
