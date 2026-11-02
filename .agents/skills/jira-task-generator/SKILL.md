---
name: jira-task-generator
description: Generate Jira tasks for Kanban Boards (with upfront Implementation Plan categorized by Epic/Task/Story, Jira Board URL verification, and direct push to MCP Jira at https://klgtech.atlassian.net/) based on git branch or commit inspection.
---

# Jira Task Generator (Kanban & MCP Jira)

This skill generates accurate Jira tasks by **directly inspecting branch and commit contents**, creating an **upfront Jira Implementation Plan** categorized by **Epic / Task / Story** suited for a **Kanban Board**, confirming the Jira Board URL, and pushing directly to **MCP Jira (`https://klgtech.atlassian.net/`)** upon user approval.

---

## Core Rules

1. **Mandatory Upfront Jira Implementation Plan:**
   Never create or push issues directly to Jira without first authoring a structured Jira Implementation Plan for user review and explicit approval.
2. **Kanban Board Categorization (Epic / Story / Task):**
   The Jira project operates on a **Kanban Board** style. Every unit of work must be accurately classified:
   - **`Epic`**: Major initiatives or new feature modules spanning multiple components or cross-service flows.
   - **`Story`**: End-user capability or functional enhancement delivering direct business value.
   - **`Task`**: Technical chores, bug fixes, refactoring, unit test setups, or configuration changes.
3. **Jira Base URL & Board URL Verification:**
   - Official Base URL: `https://klgtech.atlassian.net/`
   - The agent must verify or confirm the target **Kanban Board URL or Project Key** (e.g., `https://klgtech.atlassian.net/jira/software/c/projects/<KEY>/boards/<BOARD_ID>` or Project Key `KEY`) prior to dispatching issues.
4. **Direct Push to MCP Jira:**
   Immediately after the user approves the Jira Implementation Plan, the agent invokes the MCP Jira tool to create the issues and reports active ticket links formatted as `https://klgtech.atlassian.net/browse/<KEY>`.
5. **Language Mandate:**
   The upfront **Jira Implementation Plan review document MUST be written in Indonesian by default** for presentation to the user, while technical engineering terms remain in English.

---

## Workflow Steps

### Step 1 — Target Branch & Git Evidence Inspection
1. Inspect current branch and git status:
   ```bash
   git rev-parse --abbrev-ref HEAD
   git status --short
   ```
2. Determine base branch (`main` / `master` / `develop`):
   ```bash
   git merge-base <base-branch> HEAD
   ```
3. Extract commit logs and detailed diff:
   ```bash
   git log <merge-base>..HEAD --reverse --pretty=format:"%h | %an | %ad | %s" --date=iso
   git diff <merge-base>..HEAD --stat
   git diff <merge-base>..HEAD
   ```

### Step 2 — Verify Jira Board URL / Target Project Key
Confirm target Jira destination:
- Base URL: `https://klgtech.atlassian.net/`
- Check whether the board URL or project key was provided by the user (e.g. `https://klgtech.atlassian.net/jira/software/c/projects/ABC/boards/12` $\rightarrow$ Project Key: `ABC`).
- If unknown, ask the user once: *"Please confirm the target Jira Kanban Board URL or Project Key at https://klgtech.atlassian.net/"*.

### Step 3 — Author Upfront Jira Implementation Plan (Indonesian Default)
Before calling MCP tools, author a **Jira Implementation Plan** in Indonesian for user review:

```markdown
### 📋 Jira Implementation Plan (Kanban Review)

**Target Board / Project:** <URL Board atau Project Key>
**Base URL:** `https://klgtech.atlassian.net/`

#### Daftar Item yang Akan Dibuat:

| No | Tipe (Epic / Story / Task) | Summary / Title | Parent Epic | Estimasi Manday | Deskripsi Singkat |
|---|---|---|---|---|---|
| 1 | `Epic` (jika inisiatif baru) | [Service] - [Initiative Title] | - | X manday | Ringkasan inisiatif |
| 2 | `Story` | [Service] - [Capability / Feature] | <Epic Key / No> | X manday | Ringkasan flow bisnis |
| 3 | `Task` | [Service] - [Technical Chore / Fix] | <Epic/Story Key> | X manday | Detail perubahan teknis |

---

#### Rincian Tiket:

##### Tiket 1: [Tipe] [Summary]
- **Issue Type:** `Epic` | `Story` | `Task`
- **Parent:** <Parent Link bila ada>
- **Start Date:** YYYY-MM-DD
- **End Date:** YYYY-MM-DD
- **Estimate:** X manday (~X jam kerja; 1 manday = 9 jam kerja)
- **Description:**
  **Root Cause**
  ...
  **Changes**
  - ...
  **Expected**
  ...
```

### Step 4 — Standard Field Guidelines per Ticket

1. **Title / Summary:**
   - Format: `[Service Name] - [Work Performed]`
   - Maximum ~80 characters, prefixed with an action verb (Fix, Add, Improve, Refactor, Implement).
2. **Description:**
   - **Root Cause**: Business context or technical origin based on git diff evidence.
   - **Changes**: Concrete bullets citing modified Controllers, Services, Entities, Tables, Migrations, or Unit Tests.
   - **Expected**: Observable and verifiable system behavior.
3. **Start Date & End Date:**
   - Format: `YYYY-MM-DD`. Derived from the first and latest commit author dates on the branch.
4. **Mandays Estimate:**
   - Standard Unit: **1 manday = 9 working hours** (increments of 0.25).
   - Minor change (1-2 files, config, no new test): 0.25 (~2.25 hours)
   - 1 method logic + unit test: 0.5 (~4.5 hours)
   - Small feature (Controller + Service + Model + tests): 0.75 - 1.0 (~6.75 - 9 hours)
   - Multi-layer feature + DB migration: 1.5 - 2.0 mandays

### Step 5 — Direct Push to MCP Jira (Upon Approval)
1. After the user approves the Jira Implementation Plan (`"approve plan jira"` / `"approve push"`), call the MCP Jira tools to create issues at `https://klgtech.atlassian.net/`.
2. Creation Sequence:
   - If an **Epic** is present: create the Epic first to obtain its Epic Key.
   - Create subsequent **Stories** or **Tasks** and link their `parent` to the corresponding Epic.
3. Report the result back to the user:
   ```markdown
   ✅ Successfully created issues in Jira:
   - Epic : [ABC-101](https://klgtech.atlassian.net/browse/ABC-101) - [Service] Initiative
   - Story: [ABC-102](https://klgtech.atlassian.net/browse/ABC-102) - [Service] Feature
   - Task : [ABC-103](https://klgtech.atlassian.net/browse/ABC-103) - [Service] Technical Task
   ```
