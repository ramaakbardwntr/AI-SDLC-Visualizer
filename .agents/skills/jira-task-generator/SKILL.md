---
name: jira-task-generator
description: Generate Jira tasks (title, description containing root cause/changes/expected, start date, end date, and mandays estimate) based on inspection of git branches or commits. Use this skill whenever the user requests "create Jira task", "generate Jira", "make a ticket", "log task", "fill Jira from commit/branch", "estimate mandays", or requests a summary of work from branches/commits for reporting, even if the user does not explicitly mention the words "skill" or "Jira".
---

# Jira Task Generator

This skill generates accurate Jira tasks by **directly inspecting branch and commit contents** (never guessing from branch names or memory). All task details must be traceable back to git evidence.

## Expected Output

Every generated task must contain:

1. **Title** formatted as `[Service Name] - [Work Performed]`
2. **Description** structured in three distinct sections: Root Cause, Changes, Expected
3. **Start Date** and **End Date**
4. **Mandays Estimate** (1 = 1 day, 0.5 = 1/2 day, 0.25 = 1/4 day; 1 day = 9 working hours)

---

## Workflow Steps

### Step 1 — Identify the Target (Branch / Commits)

Priority hierarchy:
1. If the user explicitly mentions a branch or commit hash/range → use that.
2. If omitted → use the currently active branch.

Execute:
```bash
git rev-parse --abbrev-ref HEAD        # active branch
git status --short                     # check uncommitted changes
```

Determine the **base branch** (evaluation order: `develop`, `main`, `master`, or user-specified):
```bash
git merge-base <base-branch> HEAD
```
If the base branch is ambiguous or multiple candidates exist, **ask the user once** before continuing. Never guess.

### Step 2 — Gather Git Evidence

Extract the list of commits belonging specifically to this branch (excluding base commits):
```bash
git log <merge-base>..HEAD --reverse --pretty=format:"%h | %an | %ad | %s" --date=iso
```

Collect diff summaries and changes:
```bash
git diff <merge-base>..HEAD --stat
git diff <merge-base>..HEAD
```

If the diff is large, focus on critical files (Services, Controllers, Handlers, Repositories, Entities/Models, Migrations, and Unit Tests), ignoring generated files like `*.Designer.cs`, `*.snapshot`, lock files, and `bin/obj`.

If the user targets **a single commit**:
```bash
git show <hash> --stat --patch
```

If there are **uncommitted changes**, note in the output that they are not included unless the user specifically asks to inspect `git diff HEAD`.

Inspect commit bodies (`git log --format=%B`), ticket keys in branch names (e.g. `feature/ABC-123-...`), and `// TODO` / `// FIX` comments in the diff to capture the intent behind changes.

### Step 3 — Determine the Service Name

Identify the service name by checking in order:
1. The .NET project or solution with the most changes (`*.csproj`, folder `src/<ServiceName>`).
2. The repository root name (`git rev-parse --show-toplevel`).
3. Root namespaces of modified files.

Use standard team naming conventions (e.g. `Payment Service`, `Order API`), not raw filesystem paths. If changes span multiple distinct services, generate **one task per service**.

### Step 4 — Author the Title

Format:
```
[Service Name] - [Work Performed]
```

Rules:
- Begin with an action verb (Fix, Add, Improve, Refactor, Implement, Remove).
- Be concise and specific, maximum ~80 characters.
- Describe the business outcome or capability, not internal file names.

Examples:
- `Payment Service - Fix transaction duplication during callback retry`
- `Order Service - Add customer order cancellation endpoint`

### Step 5 — Author the Description

Use this exact structure:

```
**Root Cause**
<Problem cause or business requirement background>

**Changes**
- <Change 1 (affected class/method/endpoint/table)>
- <Change 2>

**Expected**
<Expected behavior and verifiable outcomes after changes>
```

Section guidelines:
- **Root Cause**
  - For bugs: explain *why* the bug occurred (state, data, flow) supported by diff evidence. Example: query omitted `IsDeleted` filter, returning soft-deleted records.
  - For features/improvements: explain previous limitations or business driver.
  - If root cause **cannot be deduced from commits**, write `Needs confirmation: <unclear detail>` rather than inventing explanations.
- **Changes**
  - One bullet per significant change, citing modified classes, methods, endpoints, tables, or migrations.
  - Cite added or updated unit tests (e.g. `OrderServiceTests`).
  - Do not copy raw commit messages verbatim; summarize clearly for PM and QA reviewers.
- **Expected**
  - Describe observable, verifiable behaviors (input → output, state changes, persistent records).
  - Explicitly mention handled edge cases or negative scenarios.

### Step 6 — Determine Start and End Dates

Date format: `YYYY-MM-DD`.

- **Start Date** = author date of the **first** commit on the branch (`%ad` from Step 2).
- **End Date** = author date of the **latest** commit on the branch.
- If only one commit exists, Start Date = End Date.
- User-provided dates always override git dates.
- If commit dates span long gaps with no activity (> 2 business days), append a note: `Notice: commit inactivity gap observed on <dates>, please confirm if date range is accurate.`

### Step 7 — Calculate Mandays Estimate

Unit: **1 manday = 9 working hours**.

| Value | Work Hours |
|---|---|
| 0.25 | ~2.25 hours |
| 0.5 | ~4.5 hours |
| 0.75 | ~6.75 hours |
| 1.0 | 9 hours |

Calculate using **two methods**, then select the most rational value:

**A. Based on Change Complexity (Primary Benchmark)**

| Scope of Change | Estimate |
|---|---|
| Minor change: 1-2 files, simple fix, config/constant tweak, no new tests | 0.25 |
| Logic fix/update in 1 method + unit test adjustments or additions | 0.5 |
| Small endpoint/feature: Controller + Service + Model + unit tests | 0.75 - 1.0 |
| Medium feature: multiple layers, database migration/table update, extensive test scenarios | 1.5 - 2.0 |
| Large feature or external client integration | 2.0+ (recommend splitting into multiple tasks) |

Increment factors (+0.25 per factor): database migrations, 3rd-party external integrations, cross-cutting refactoring, complex test setups (seeders and cleanups), and difficult root cause investigations.

**B. Based on Commit Time Span (Comparison Benchmark)**
Group commits into working sessions (intervals ≤ 3 hours belong to one session). Sum session durations plus ~30 minutes buffer for initial setup. Do not count overnight hours or weekends as full work periods.

**Final Determination Rules:**
- Round to the nearest **0.25** increment. Minimum estimate is 0.25.
- If A and B diverge significantly (> 0.5), use A and state the justification in one sentence.
- If the estimate exceeds 2.0 mandays, advise splitting the work into smaller Jira tasks.
- Include the estimate rationale in the output, e.g. `0.75 (1 new endpoint + unit tests, ~6.75 hours)`.

### Step 8 — Pre-Submission Validation Checklist

- [ ] Title adheres to `[Service Name] - [Work Performed]`.
- [ ] Every bullet in Changes points to verifiable files/commits in the git diff.
- [ ] Root Cause contains no unverified assumptions.
- [ ] Start Date ≤ End Date, both formatted as `YYYY-MM-DD`.
- [ ] Mandays are in increments of 0.25 adhering to the benchmark table.
- [ ] Description is free of secrets, credentials, tokens, or PII.

### Step 9 — Dispatch to Jira or Format Output

1. **If Jira MCP/tooling is available**: present the draft to the user first, then **request confirmation** before creating the issue. Never create issues without explicit user authorization.
   - Field mappings: Summary = Title, Description = Step 5 text, Start Date, Due Date = End Date, Original Estimate = mandays × 9h (e.g. 0.5 → `4h 30m`).
   - Project key, issue type, and assignee: derive from branch name or ask user if unconfirmed.
2. **If no Jira tooling is present**: render the output in copy-paste format.

---

## Output Format

```
### Title
[Service Name] - [Work Performed]

### Description
**Root Cause**
...

**Changes**
- ...

**Expected**
- ...

### Dates
- Start Date : YYYY-MM-DD
- End Date   : YYYY-MM-DD

### Mandays Estimate
X (short rationale)

### Source Reference
- Branch : <branch-name>
- Range  : <merge-base>..<head> (N commits)
- Notes  : <items needing confirmation, if any>
```

---

## Important Rules

- **Always inspect git first.** Never generate tasks purely from branch names or unverified memory.
- **Never fabricate information.** State gaps as `Needs confirmation`.
- **One task = one service and one primary objective.** Recommend splitting unrelated changes.
- **Language:** Default to user preference for conversational responses; Technical terms remain English (Controller, Service, Migration, etc.).
- **Consistent Estimates:** 1 manday is always strictly defined as 9 working hours.
