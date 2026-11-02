---
name: implementation-plan
description: Author an Implementation Plan for .NET engineering tasks in standard format (findings, affected files, multi-option solutions with pros/cons/recommendation, unit test namespace audit and meaningful coverage, and optional docs/PR offers) in Indonesian by default for user review and approval prior to coding.
---

# Implementation Plan

The implementation plan is a basis for discussion and decision-making, not a mere formality. The user makes decisions based on this document, so it must be honest, specific, and traceable to the codebase. Use `templates/implementation-plan.md` as the skeleton and persist it at `.office/tasks/<id>/plan.md`.

> [!IMPORTANT]
> **Output Language Mandate:** All generated Implementation Plan documents (`plan.md` / `implementation_plan.md`) **MUST be written in Indonesian (Bahasa Indonesia) by default**. Standard software engineering technical terms remain in English (e.g. Controller, Service, Repository, Migration, DbContext, Mock, Seeder, DTO, Payload, Event Consumer, etc.).

## Known Files Approach (Mode A)
1. Read the files referenced by the user. Trace callers and dependencies (`grep` class/method names) to surface unmentioned impacts.
2. Restate the task in your own words (one concise paragraph in Indonesian) so misunderstandings are caught early.

## Business Flow / Trace Issue (Mode B)
1. Identify the entry point (endpoint, message consumer, background job). Trace execution flow down to Services, Repositories, and database tables.
2. Gather evidence in `path:line` format. Strictly separate **Facts** from **Hypotheses**; assign confidence levels (high/medium/low).
3. If root cause cannot yet be determined with certainty, state so clearly and propose verification steps (logs, read-only queries, reproduction test). Do not force a solution on top of unverified assumptions.

## Plan Structure (Fixed Order)

1. **Task Summary (Ringkasan Task):** One concise descriptive paragraph in Indonesian stating the goal, problem background, and scope boundaries.
2. **Findings (Temuan):** Current workflow, root cause or architectural gap, concrete file citations (`path/File.cs:123`), separating facts from hypotheses.
3. **Scope of Changes (Scope Perubahan):** Structured table `File | Class/Method | Action (modify/add/delete) | Rationale`.
4. **Solution Options (Opsi Solusi - Multi-Options):**
   - Present multiple technical approaches (`Opsi A`, `Opsi B`, `Opsi C`, etc.) whenever valid architectural alternatives exist.
   - Each option must detail: **Technical Approach**, **Pros**, **Cons**, **Risks**, and **Mandays Estimate** (increments of 0.25; 1 manday = 9 work hours, aligned with `jira-task-generator`).
   - Conclude with a definitive **Recommendation** indicating the single best option along with technical and business rationales.
5. **Impacts (Dampak):**
   - Database: entities, columns, indexes, migrations (whether a *Database Changes Query* is needed in the PR), existing data compatibility.
   - API contract (breaking changes?), messaging (Kafka/RabbitMQ), background jobs, configuration/environment variables, performance, backward compatibility.
6. **Unit Test Impact (Dampak Unit Test):**
   - **Namespace Test Audit:** Prior to designing scenarios, the agent **MUST read all existing test cases** in the namespace or test class related to the modified function.
   - **Consolidation & Eliminating Redundancy:** Inspect existing test cases. If redundant, overlapping, or obsolete tests exist, explicitly plan to delete or consolidate them to keep the test suite lean and fast.
   - **100% Meaningful Coverage (Except Mocks):** Ensure tests maintain 100% branch/logic coverage of the modified function (**except external/third-party dependencies that are mocked**). Tests must be **meaningful for real business flows**—avoid over-testing (generating repetitive tests for trivial variations) and avoid over-engineering.
   - **Adhere to Existing Project Structure & Style:** Mirror the existing test project conventions, folder layout, seeder/cleanup patterns, factories, helpers, naming conventions, and code style.
   - If no test project exists: explicitly record the gap and ask if the user wants test projects set up.
7. **Documentation Impact (Dampak Dokumentasi - Optional):**
   - Documentation is **optional**. Tech Doc or RFC updates in Strand/Docmost are only planned if the user explicitly confirms the need to update documentation.
8. **Branch:** User-provided branch name, status (new / existing), base branch (`main` / `master`).
9. **Open Questions & Assumptions:** State unconfirmed details or assumptions explicitly (`Perlu konfirmasi: ...`).
10. **Post-Plan Offers (Mandatory Follow-up Prompts):**
    At the conclusion of every implementation plan, offer two follow-up actions to the user:
    - **a. Strand Docmost MCP Update (Optional):**
      Ask whether the related Tech Doc or RFC on Strand Docmost MCP should be updated. Emphasize that the user **MUST provide the Space name and document name (or Strand URL link)**.
    - **b. GitHub Pull Request Creation:**
      Ask whether to create a Pull Request to GitHub. **The agent MUST first verify** whether the active branch already has an open PR via `gh pr list --head <branch>`. Only offer PR creation if no PR exists yet; if one already exists, display the existing PR link.
11. **Decision Required (Keputusan yang Dibutuhkan):** Clear call to action, e.g. `Balas: "approve opsi A" / minta revisi / batal`.

---

## Quality Guidelines (Merged from CLAUDE.md)

The following behavioral guidelines must be strictly obeyed during planning and execution to prevent common LLM mistakes:

### 1. Think Before Coding
- **Do not assume. Do not hide confusion. Surface tradeoffs.**
- State your assumptions explicitly. If uncertain, stop and ask (`Perlu konfirmasi: ...`).
- If multiple interpretations or alternatives exist, present them all—never pick silently.
- If a simpler approach exists, propose it openly and push back when the requested plan is overly complicated.

### 2. Simplicity First
- **Minimum code that solves the problem. Nothing speculative.**
- Do not plan features beyond what was requested.
- Do not introduce abstractions for single-use code.
- Do not add speculative configurability, flexibility, or error handling for impossible scenarios.
- Ask yourself: *"Would a senior engineer say this is overcomplicated?"* If yes, simplify.

### 3. Surgical Changes
- **Touch only what you must. Clean up only your own mess.**
- Do not "improve" adjacent code, comments, or formatting in areas that are not broken.
- Do not refactor functional code.
- Match existing project style and structure, even if you would do it differently.
- If you notice unrelated dead code, mention it as a finding—do not delete it unless asked.
- Remove orphaned imports, variables, or methods caused by your own changes. Every changed line must trace directly to the user's request.

### 4. Goal-Driven Execution
- **Define verifiable success criteria.**
- Transform tasks into measurable goals:
  - *"Add validation"* $\rightarrow$ *"Write test for invalid inputs, then make it pass."*
  - *"Fix bug"* $\rightarrow$ *"Write a test reproducing the bug, then make it pass."*
- For sequential steps, define explicit verification:
  ```
  1. [Step] -> verify: [check / test filter]
  2. [Step] -> verify: [check / test filter]
  ```
- Rigorously detail Cons, including for the recommended option.
- **Never modify source code before the plan is approved (Gate 1).** The plan is the sole output of this phase.
