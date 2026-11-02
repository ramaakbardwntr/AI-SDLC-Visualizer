---
name: jira-task-generator
description: Generate Jira tasks for Kanban Boards (with upfront Implementation Plan categorized by Epic/Task/Story, Jira Board URL verification, governance custom fields mapping, and direct push to Jira at https://klgtech.atlassian.net/) based on git branch or commit inspection.
---

# Jira Task Generator (Kanban & Jira Cloud)

This skill generates accurate Jira tasks by **directly inspecting branch and commit contents**, authoring an **upfront Jira Implementation Plan** categorized by **Epic / Story / Task** suited for a **Kanban Board**, confirming the Jira Board URL, Project Key, and governance custom fields, and pushing directly to **Jira Cloud (`https://klgtech.atlassian.net/`)** via `tools/jira-client.mjs` upon user approval.

---

## Core Rules

1. **Mandatory Upfront Jira Implementation Plan:**
   Never create or push issues directly to Jira without first authoring a structured Jira Implementation Plan for user review and explicit approval.
2. **Kanban Board Categorization (Epic / Story / Task / Sub-task):**
   The Jira project operates on a **Kanban Board** style. Every unit of work must be accurately classified:
   - **`Epic`**: Major initiatives or new feature modules spanning multiple components or cross-service flows.
   - **`Story`**: End-user capability or functional enhancement delivering direct business value.
   - **`Task`**: Technical chores, bug fixes, refactoring, unit test setups, or configuration changes.
   - **`sub-task`**: Granular breakdown child items attached to a parent Story or Task.
3. **Jira Base URL & Project Key Verification:**
   - Official Base URL: `https://klgtech.atlassian.net/`
   - Default / Target Project Keys: Verify the project key (e.g., `BOWP`, `FNBAPI`, `FNBMOB`, `STECO`, `LIV`) from the user, branch name, or `office.config.yml`.
   - If unknown, ask the user once: *"Please confirm the target Jira Kanban Board URL or Project Key at https://klgtech.atlassian.net/"*.
4. **Governance Custom Fields (Mandatory 4 Parameters):**
   Every issue created in KLG Jira requires or benefits from standard enterprise governance metadata. The agent must specify these 4 fields in the plan and push payload:
   - **`Application (Global)`** (`customfield_12291`): The primary system or client app (e.g., `Superapps`, `MyLiving`, `POS Phoenix FnB`, `CMS`, etc.).
   - **`Tribe/Department (Global)`** (`customfield_12290`): The owning department. **Default**: `Back Office & E-Commerce`.
   - **`SDLC Evidences`** (`customfield_12370`): Cascading Select (`Parent` $\rightarrow$ `Child`).
     - Example standard development task: `Development Iteration:develop` (Parent: `Development Iteration`, Child: `develop`).
     - Example bugfix/support task: `Support:Fixing` (Parent: `Support`, Child: `Fixing`).
     - Example RFC task: `Development Iteration:RFC`.
     - Example TD task: `Release:Technical Document (TD)`.
   - **`Business Unit (Global)`** (`customfield_12289`): Multi-select (array of options). Can accept multiple BUs separated by comma (e.g., `FBI`, or `FBI,AHI`, `HCI`, `Property`, etc.).
5. **Authentication & Credential Management:**
   - Jira Cloud REST API uses **HTTP Basic Authentication** (`Authorization: Basic base64(email:api_token)`).
   - Credentials are read automatically from `.mcp.json` under `mcpServers.jira` (`serverUrl`, `email`, `apiToken`, and `headers.Authorization`).
   - The CLI helper `node tools/jira-client.mjs` handles this authentication seamlessly.
6. **Direct Push Execution (Upon Approval):**
   - Push occurs only after Gate 3 approval (`"approve plan jira"`, `"approve push"`, or `"create jira"`).
   - Use `node tools/jira-client.mjs create` to create tickets, ensuring correct hierarchy: create parent **Epics** first, then link child **Stories** or **Tasks** via `--parent <EPIC_KEY>`.
   - Pass the custom field flags: `--app`, `--tribe`, `--sdlc`, `--bu`.
   - Issue creation automatically triggers visualizer handoff to Jira (`node tools/office-state.mjs handoff sonnet jira "Write Jira"`).
7. **Review Plan Language Mandate:**
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

### Step 2 — Verify Jira Board URL, Project Key & Governance Fields
1. Confirm target Jira destination:
   - Base URL: `https://klgtech.atlassian.net/`
   - Default project key from `office.config.yml` (e.g., `BOWP`) or ask the user.
2. Inspect or confirm available options if needed:
   ```bash
   node tools/jira-client.mjs options --project <KEY>
   ```
3. Resolve governance custom field mapping:
   - **Application (Global)**: e.g., `Superapps` (or `MyLiving` for Living World repos)
   - **Tribe/Department (Global)**: `Back Office & E-Commerce` (default)
   - **SDLC Evidences**: `Development Iteration:develop` (or `Support:Fixing` for fixes)
   - **Business Unit (Global)**: `FBI` (or multiple: `FBI,AHI`, etc.)

### Step 3 — Author Upfront Jira Implementation Plan (Indonesian Default)
Before calling creation commands, author a **Jira Implementation Plan** in Indonesian for user review:

```markdown
### 📋 Jira Implementation Plan (Kanban Review)

**Target Board / Project:** <URL Board atau Project Key, misal: BOWP>
**Base URL:** `https://klgtech.atlassian.net/`

#### Governance & Custom Field Mapping:
- **Application (Global):** `Superapps`
- **Tribe/Department (Global):** `Back Office & E-Commerce` *(Default)*
- **SDLC Evidences:** `Development Iteration - develop`
- **Business Unit (Global):** `FBI` *(Multiple allowed)*

---

#### Daftar Item yang Akan Dibuat:

| No | Tipe (Epic / Story / Task) | Summary / Title | Parent Epic | Estimasi Manday | Deskripsi Singkat |
|---|---|---|---|---|---|
| 1 | `Epic` (jika inisiatif baru) | [Service] - [Initiative Title] | - | X manday | Ringkasan inisiatif |
| 2 | `Story` | [Service] - [Capability / Feature] | <Epic Key / No> | X manday | Ringkasan flow bisnis |
| 3 | `Task` | [Service] - [Technical Chore / Fix] | <Epic/Story Key> | X manday | Detail perubahan teknis |

---

#### Rincian Tiket:

##### Tiket 1: [Tipe] [Summary]
- **Issue Type:** `Epic` | `Story` | `Task` | `sub-task`
- **Parent:** <Parent Link bila ada>
- **Start Date:** YYYY-MM-DD
- **End Date:** YYYY-MM-DD
- **Estimate:** X manday (~X jam kerja; 1 manday = 9 jam kerja)
- **Application:** Superapps
- **Tribe/Department:** Back Office & E-Commerce
- **SDLC Evidences:** Development Iteration - develop
- **Business Unit:** FBI
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

### Step 5 — Direct Push to Jira (Upon Approval)

1. Verify connection and current user identity:
   ```bash
   node tools/jira-client.mjs whoami
   ```
2. Create issues in topological order with all governance fields:
   - **Step 5a (If an Epic is present):**
     ```bash
     node tools/jira-client.mjs create \
       --project BOWP \
       --type Epic \
       --summary "[Service] - Initiative Name" \
       --desc "Description text..." \
       --app "Superapps" \
       --tribe "Back Office & E-Commerce" \
       --sdlc "Development Iteration:develop" \
       --bu "FBI"
     ```
     Take note of the created Epic key (e.g., `BOWP-5001`).
   - **Step 5b (Create Stories or Tasks linked to the Epic):**
     ```bash
     node tools/jira-client.mjs create \
       --project BOWP \
       --type Story \
       --summary "[Service] - Feature Name" \
       --desc "Description text..." \
       --parent BOWP-5001 \
       --app "Superapps" \
       --tribe "Back Office & E-Commerce" \
       --sdlc "Development Iteration:develop" \
       --bu "FBI"

     node tools/jira-client.mjs create \
       --project BOWP \
       --type Task \
       --summary "[Service] - Technical Task" \
       --desc "Description text..." \
       --parent BOWP-5001 \
       --app "Superapps" \
       --tribe "Back Office & E-Commerce" \
       --sdlc "Development Iteration:develop" \
       --bu "FBI"
     ```
3. Report the result back to the user with clickable URLs:
   ```markdown
   ✅ Successfully created issues in Jira:
   - Epic : [BOWP-5001](https://klgtech.atlassian.net/browse/BOWP-5001) - [Service] Initiative
   - Story: [BOWP-5002](https://klgtech.atlassian.net/browse/BOWP-5002) - [Service] Feature
   - Task : [BOWP-5003](https://klgtech.atlassian.net/browse/BOWP-5003) - [Service] Technical Task
   ```
