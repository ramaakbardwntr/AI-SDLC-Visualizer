---
name: pr-description-generator
description: Generate GitHub Pull Request descriptions matching team standards (Issue Link, Description, Changes, Screenshots, Checklist) in GitHub Flavored Markdown (GFM) format ready for copy-paste (including raw PostgreSQL migration scripts when database changes occur), based on git branch and commit inspections. Use whenever the user asks to "create PR", "make pull request", "write PR description", "generate PR", "PR template", "gh pr create", or requests a summary of branch changes for code review.
---

# PR Description Generator

This skill generates GitHub Pull Request descriptions by **directly reading the contents of the branch and commits**. All PR content must be traceable to git evidence, not guessed from the branch name.

## Standard Team Template (Must Be Used Verbatim)

Section structure, labels, ordering, and checklist text **must not be altered** (including the exact text `It has meet the definition of done`), as these represent established team standards. Format: GitHub Flavored Markdown (GFM).

```markdown
## Pull Request

**Issue Link:** [Link to the related issue, if applicable]

**Description:**

[Provide a brief description of your changes.]

**Changes:**

- [List the changes or features you've implemented.]

**Screenshots:**

[If your changes affect the user interface, include screenshots or animated GIFs.]

**Checklist:**

- [ ] I have tested my changes.
- [ ] It has meet the definition of done
- [ ] My code follows the project's coding guidelines.
- [ ] I have updated the documentation, if necessary.
```

Markdown Formatting Rules:
- Use standard GitHub Flavored Markdown (GFM): `##` for section header, `**Label:**` for section labels, and `- ` for bullet points. **Do not use HTML tags** (`<h2>`, `<p>`, `<strong>`, `<ul>`, `<li>`, `<code>`, `<pre>`, `<a>`).
- **The checklist must be a Markdown task list** (`- [ ]` / `- [x]`). Ensure empty blank lines precede and follow the task list.
- Format class, method, table, and endpoint names with inline code backticks (` `code` `).
- Format links with standard Markdown `[label](url)`.
- If the repository has a distinct `.github/pull_request_template.md`, ask the user once which template to use. Default to the standard template above.

---

## Workflow Steps

### Step 1 - Determine Branch and Base Branch

```bash
git rev-parse --abbrev-ref HEAD
git status --short
```

Base branch: use the one specified by the user. If omitted, try `develop`, `main`, `master` in order. If multiple candidates exist, ask the user once; do not guess.

```bash
git merge-base <base-branch> HEAD
```

### Step 2 - Gather Git Evidence

```bash
git log <merge-base>..HEAD --reverse --pretty=format:"%h | %an | %ad | %s" --date=iso
git diff <merge-base>..HEAD --stat
git diff <merge-base>..HEAD
```

If the diff is large, read file-by-file for core files (Controllers, Services, Handlers, Repositories, Entities/Models, Migrations, and Unit Tests). Ignore generated files like `*.Designer.cs`, `*.snapshot`, lock files, and `bin/obj`.

Read commit bodies (`git log --format=%B`) and `// TODO` / `// FIX` comments in the diff to capture the intent behind changes.

If uncommitted changes exist, note at the end that they are **not included** in the PR.

### Step 3 - Fill **Issue Link**

Search in order:
1. Issue link or number specified by the user.
2. Ticket key in the branch name or commit messages (pattern `[A-Z]+-\d+`, e.g. `ABC-123`) or `#123` for GitHub Issues.
3. If none found: write `N/A`.

Rules:
- GitHub Issues: write `Closes #123` for automatic closing on merge, or `Related to #123` if not closing.
- Jira: combine with known Jira base URL (from repo config, README, or user) into `[ABC-123](https://...)`. If base URL is unknown, write the key alone (`ABC-123`) without fabricating a URL.

### Step 4 - Write **Description**

One concise paragraph (2-4 sentences) answering:
- What is the problem or requirement (brief context)
- What technical approach was taken
- What is the impact on the system or users

Rules:
- Write from the perspective of a reviewer unfamiliar with the context.
- Never copy raw commit messages verbatim.
- Never fabricate reasons not present in the diff/commits. If motivation is unclear, write `Needs confirmation: <unclear detail>`.

### Step 5 - Write **Changes**

Bulleted list (`- `) with one item per meaningful change.

Rules:
- Mention specific class, method, endpoint, table, or migration names, e.g. `Add endpoint `POST /orders/{id}/cancel` in `OrdersController``.
- Group by architectural layer if numerous (API, Service/Business Logic, Data/Migration, Test) using nested bullets (`  - `). Do not introduce new heading tags.
- Mention unit tests added or updated.
- Explicitly highlight reviewer risks: **breaking changes, database migrations, configuration/environment variable changes, API contract changes, and new dependencies**.
- If database changes occurred (entities/models, DbContext, migrations), include the **Database Changes Query** (PostgreSQL) per **Step 5b** at the end of this Changes section.
- Order changes from most critical to least critical.

### Step 5b - Generate **Database Changes Query** (PostgreSQL)

Execute this step **only if the diff touches the database schema**: entities/models (columns, types, nullability, keys, relationships), `DbContext` / `OnModelCreating` / `IEntityTypeConfiguration`, or migration files. If no schema changes exist, skip this step and do not add a query block.

**5b-1. Locate schema evidence from the diff.** Not all projects use EF Migrations, so **do not rely solely on Migrations folders**. Source hierarchy:
1. Entity/model changes (new properties, changed types/nullability, new entity classes) and Fluent API/attribute configuration (`ToTable`, `HasColumnName`, `HasColumnType`, `HasMaxLength`, `IsRequired`, `HasDefaultValue`, `HasIndex`, `HasKey`, `HasForeignKey`, `[Table]`, `[Column]`, `[MaxLength]`, `[Required]`). This is the primary source.
2. If the project uses migrations and they appear in the diff: use `Up()` as a comparison benchmark (`AddColumn`, `CreateTable`, `CreateIndex`, `AlterColumn`, `Sql(...)`).
3. If manual `.sql` files are in the diff: use them as the source of truth without rewriting them.

```bash
git diff <merge-base>..HEAD --name-only -- '*.cs' | grep -Ei "entit|model|domain|dbcontext|configuration"
```

Inspect modified entities **and existing peer entities** (to mirror audit/base class columns, e.g. `created_by`, `created_at`, `updated_by`, `updated_at`, `version`).

**5b-2. Follow project conventions.** Check from existing entities, configuration, or prior scripts in the repo. Common conventions in this team:
- **Schema-qualified:** `catalog.categories` or `catalog.products`. Schema comes from `ToTable(name, schema)` / `HasDefaultSchema` / peer entities. Do not omit the schema prefix.
- **snake_case for table and column names**, unquoted. Quote only reserved words or case-sensitive identifiers (e.g. `"version"`).
- **Constraint and index naming:** primary key `pk_<table_name>` (or `"PK_<table_name>"` if following legacy scripts), index `ix_<table_name>_<column_name>`, unique index `ux_<table_name>_<column_name>`, foreign key `fk_<table_name>_<parent_table>_<column_name>`.
- If conventions cannot be determined, write `Needs confirmation: <naming / schema convention>` in Notes for Author and state the assumption used.

**5b-3. C# to PostgreSQL Type Mapping** (override if `HasColumnType` / `HasMaxLength` / `HasPrecision` exists):

| C# Type | PostgreSQL Type |
|---|---|
| `string` | `text`, or `varchar(n)` if `MaxLength` / `HasMaxLength(n)` |
| `int` / `long` / `short` | `integer` / `bigint` / `smallint` |
| `decimal` | `numeric(p,s)` per configuration |
| `double` / `float` | `double precision` / `real` |
| `bool` | `boolean` |
| `DateTime` | `timestamp` (without time zone, per team standard), unless `HasColumnType("timestamptz")` |
| `DateTimeOffset` | `timestamptz` |
| `DateOnly` / `TimeOnly` | `date` / `time` |
| `Guid` | `uuid` |
| `byte[]` | `bytea` |
| `enum` | `integer` (or `text` if `HasConversion<string>()`) |
| Nullable (`T?`, `string?`) | `NULL`, otherwise `NOT NULL` |

**5b-4. Query authoring rules:**
- New column: `ALTER TABLE <schema>.<table_name> ADD <column_name> <type> NULL;` (one statement per column, single line).
- New table: `CREATE TABLE <schema>.<table_name> (...)` with columns formatted one per line (consistent indentation), ending with `CONSTRAINT <pk> PRIMARY KEY (...)`. Add foreign keys, unique constraints, and checks only if present in entities/configurations.
- Indexes: `CREATE INDEX ...` / `CREATE UNIQUE INDEX ...` placed below the respective table. Use `USING btree` only if following existing repository scripts.
- `DEFAULT` values: only if explicitly defined in entity/configuration (e.g. `DEFAULT (now() at time zone 'utc')`). Do not invent default values.
- `NOT NULL` columns on tables with existing data: include a `DEFAULT`, or add as `NULL` first, `UPDATE` backfill, then `ALTER COLUMN ... SET NOT NULL`.
- Type changes: `ALTER TABLE ... ALTER COLUMN ... TYPE ... USING ...;`. Rename: `ALTER TABLE ... RENAME COLUMN ... TO ...;`. Nullable/default: `SET NOT NULL` / `DROP NOT NULL` / `SET DEFAULT` / `DROP DEFAULT`.
- Dropping columns or tables (`DROP COLUMN`, `DROP TABLE`) must be explicitly flagged as **destructive** in the Changes bullets and Notes for Author.
- Order by dependency: parent tables before child tables, grouped per table with empty lines between groups.
- No `BEGIN/COMMIT`, `IF NOT EXISTS`, or rollbacks required unless requested. Include rollback scripts only for destructive changes if requested.
- Queries must strictly reflect the diff. Do not invent columns or indexes.
- **Never execute queries against any database.** Queries are presented strictly for review and execution by the author or DBA.

**5b-5. Presentation in the PR.** Place at the **end of the Changes section** (after the list items), formatted with a bold label followed by a plain fenced code block (without language tag) for easy copying. This is not a new heading. Mandatory format:

````markdown
**Database Changes Query:**

```
ALTER TABLE catalog.products ADD category_id uuid NULL;
ALTER TABLE catalog.products ADD category_name text NULL;

CREATE TABLE catalog.categories (
	id uuid NOT NULL,
	code text NULL,
	name text NULL,
	updated_by text NULL,
	updated_at timestamp NULL,
	created_by text NOT NULL,
	created_at timestamp NOT NULL,
	"version" uuid NOT NULL,
	CONSTRAINT pk_categories PRIMARY KEY (id)
);
CREATE INDEX ix_categories_code ON catalog.categories USING btree (code);

ALTER TABLE catalog.product_groups ADD category_id uuid NULL;

CREATE TABLE catalog.product_inventory (
	id uuid NOT NULL,
	sku text NOT NULL,
	warehouse_code text NULL,
	lead_time_days integer NULL,
	updated_by text NULL,
	updated_at timestamp NULL,
	created_by text NOT NULL,
	created_at timestamp NOT NULL DEFAULT (now() at time zone 'utc'),
	"version" uuid NOT NULL,
	CONSTRAINT pk_product_inventory PRIMARY KEY (id)
);
CREATE INDEX ix_product_inventory_sku ON catalog.product_inventory (sku);
CREATE UNIQUE INDEX ux_product_inventory_sku_warehouse ON catalog.product_inventory (sku, warehouse_code);

ALTER TABLE catalog.product_listings ADD notes varchar(500) NULL;
```
````

### Step 6 - Identify and Execute Impacted Tests Only

Goal: verify safety without running the entire test suite.

**6a. Check if tests are needed.** Run tests only if changes impact runtime behavior (`*.cs` non-generated: business logic, repositories, controllers, entities, validators, mappers). **Skip** if the diff consists solely of docs, comments, formatting, non-code config, or pure UI. If skipped, document the reason in Notes for Author.

**6b. Map changes to relevant tests:**
```bash
# Modified .cs files outside test projects
git diff <merge-base>..HEAD --name-only -- '*.cs'

# Modified methods from diff hunk headers
git diff <merge-base>..HEAD -U0 -- '<file-path>.cs'
```

Mapping hierarchy:
1. **Tests modified in the diff** (`*Tests.cs`): use directly.
2. **Naming conventions**: `OrderService` -> `OrderServiceTests`. Search using:
   ```bash
   grep -rl "OrderService" --include=*Tests.cs <test-folder>
   ```
3. **Direct consumers**: if Repository/Model/Helper changed, find test classes referencing them or parent Services/Controllers.
4. If a specific method changed, narrow filter down to method level (`FullyQualifiedName~OrderServiceTests.CancelOrder`).

**6c. Verify filter before execution:**
```bash
dotnet test <Project.Tests.csproj> --list-tests --filter "FullyQualifiedName~OrderServiceTests"
```

**6d. Execute filtered tests only:**
```bash
dotnet test <Project.Tests.csproj> --filter "FullyQualifiedName~OrderServiceTests|FullyQualifiedName~PaymentServiceTests.RetryPayment"
```

Rules:
- **Never** run `dotnet test` without `--filter` across entire solutions/projects unless the user explicitly requests it.
- If no related tests are found: **do not fall back to running all tests**. Leave the checklist item `[ ]`, document the absence in Notes for Author, and suggest adding coverage.
- Tests in this repo use local/test databases with seeders and cleanups. Verify connection strings target a **test/local database**. If uncertain, ask user before running.
- Record passed/failed counts and the executed filter for Notes for Author.

### Step 7 - Fill **Screenshots**

- If the diff touches UI (`.razor`, `.cshtml`, `.css`, `.tsx`, `.vue`, etc.): write `[To be attached by author]` and specify the screens/components requiring screenshots. The assistant **must not** fabricate or link images.
- If purely backend/API: write `N/A - no UI changes.` For API changes, brief sample request/response snippets may be attached in fenced code blocks (```json ... ```).

### Step 8 - Fill **Checklist**

Check `[x]` **only** when evidence exists. Otherwise leave `[ ]` for the author to review.

| Item | Check `[x]` If |
|---|---|
| I have tested my changes. | Impacted tests (Step 6) were executed and **all passed**, or user confirmed manual testing. If tests were skipped or absent, leave `[ ]`. |
| It has meet the definition of done | Only if confirmed by user. Default is `[ ]`. |
| My code follows the project's coding guidelines. | Evidence exists, e.g. `dotnet format --verify-no-changes` / analyzers pass, or user confirmed. |
| I have updated the documentation, if necessary. | Diff includes doc updates (README, docs, XML comments, Swagger), or no doc updates were required. |

### Step 9 - Pre-Submission Validation Checklist

- [ ] Headings and section ordering match the template verbatim.
- [ ] Valid GitHub Flavored Markdown: standard headings (`##`), bold labels (`**Label:**`), and list bullets (`- `). No raw HTML tags (`<h2>`, `<p>`, `<strong>`, `<ul>`, `<li>`, `<code>`).
- [ ] Checklist uses Markdown task list syntax (`- [ ]` / `- [x]`).
- [ ] Every bullet in Changes points to verifiable code in the diff.
- [ ] Issue Link contains no fabricated URLs.
- [ ] If database changed: **Database Changes Query** is located at the end of Changes, unformatted language fence, reflecting diff entities.
- [ ] Database queries were not executed against any DB; destructive changes are highlighted.
- [ ] Checked checklist items have concrete proof.
- [ ] Only impacted tests were run, with recorded filter.
- [ ] No secrets, connection strings, tokens, or PII present.
- [ ] PR Title generated.

### Step 10 - PR Title and Submission

**PR Title:** `[Service Name] - [Work Performed]`, starting with an action verb (Fix, Add, Improve, Refactor, etc.). If branch has a ticket key, prefix with key, e.g. `ABC-123 Payment Service - Fix transaction duplication during retry`.

**Submission:**
1. Display title and description in **one single `markdown` code block** (using 4 backticks ````markdown if nested Database Changes Query block is present) for easy copy-pasting into GitHub.
2. If GitHub CLI (`gh`) is available and the user requests PR creation, **request confirmation first**, then execute:
   ```bash
   git push -u origin <branch>
   gh pr create --base <base-branch> --title "<title>" --body-file <description-file>.md
   ```
   Add `--draft` if the checklist is incomplete or items require confirmation.
3. Never push or create PR without explicit user approval.

---

## Output Format

`````
**PR Title:** [Service Name] - [Work Performed]

````markdown
## Pull Request

**Issue Link:** ...

**Description:**

...

**Changes:**

- ...

**Database Changes Query:**

```
<PostgreSQL queries: ALTER TABLE / CREATE TABLE per entities>
```

**Screenshots:**

...

**Checklist:**

- [ ] I have tested my changes.
- [ ] It has meet the definition of done
- [ ] My code follows the project's coding guidelines.
- [ ] I have updated the documentation, if necessary.
````

**Notes for Author:**
- Tests executed: `<executed filter>` -> <passed/failed counts>. (or: skipped due to <reason> / no related tests found)
- Database: <queries must be run prior to deployment, destructive notes, or `Needs confirmation` regarding conventions>. (remove line if no DB changes)
- <other items requiring confirmation, if any>
`````

---

## Important Rules

- **Always inspect git first.** Never author a PR purely from branch names or memory.
- **Never fabricate information.** Mark unknown details as `Needs confirmation`.
- **Targeted tests only.** Run only tests impacted by changes, and only when behavior is affected.
- **Database changes require Database Changes Query (PostgreSQL).** `ALTER TABLE` for new columns, `CREATE TABLE` for new tables. Never execute against a live database.
- **One PR = one primary objective.** Recommend splitting unrelated changes.
- **Consistent with `jira-task-generator`:** When both skills are applied to the same branch, PR Title, Root Cause, and Changes list must align with the Jira task.
