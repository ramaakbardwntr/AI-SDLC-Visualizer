---
name: tech-doc-generator
description: Use this skill whenever generating, updating, or auditing a component-based Technical Documentation ("Tech Doc") for a .NET service — distinct from an RFC, which documents a single initiative's design. Trigger on requests like "generate the tech doc for X", "spawn an agent to document this repo", "update the API Contract page", "audit tech doc coverage", or any mention of a per-service Tech Doc broken into API Contract / Kafka-Queue / RabbitMQ-Queue / Background Process / Data Model / Integration / Config / Frontend-UI. Covers the component taxonomy, per-component entry field formats, how to read a .NET repo to extract each component type, and how to write results into Strand (Docmost) via create_page_from_template / update_page.
---

# Tech Doc Generator Skill

> [!IMPORTANT]
> **Mandatory Language Requirement:** All Technical Documentation pages, entries, summaries, ERD descriptions, and changelogs generated or updated in Strand (Docmost) via MCP **MUST be written in English**.

## Overview

A **Tech Doc** is the living, accumulated technical reference for one **service** (not one initiative — that's what an **RFC** is for). It's broken into **component-type pages**, RICEFW-style but without SAP conventions, fitted to a modern backend/frontend stack. RFCs feed into the Tech Doc over time: when an RFC adds or changes a component, the relevant Tech Doc page gets a new or updated entry — the RFC is not duplicated wholesale into the Tech Doc.

This skill is used both by a human drafting a Tech Doc manually and by an **agent spawned to read a repo** and populate/update one automatically.

## Structure

```
<System> Tech Doc (parent/index page — hand-built, not templated, one per system e.g. NAOMI)
│  one row per service: name, purpose, link
│
├── <Service A> Tech Doc  (from the Service Tech Doc template — lean index page, one per service)
│   │  overview + architecture diagram + links to component pages below
│   │
│   ├── API Contract        (own page, repeated entries)
│   ├── Business Logic      (own page, repeated entries — compact representation of the logic itself, plus provenance)
│   ├── Kafka/Queue         (own page, repeated entries — WolverineFx + Kafka topics)
│   ├── RabbitMQ/Queue      (own page, repeated entries — RabbitMQ event bus via EventHelper)
│   ├── Background Process  (own page, repeated entries)
│   ├── Data Model          (own page, single ERD + per-table descriptions)
│   ├── Integration         (own page, repeated entries)
│   ├── Config              (own page, single bulk table)
│   └── Frontend/UI         (own page, repeated entries)
│
├── <Service B> Tech Doc
│   └── ... same child pages
```

**Service Tech Doc is a lean index, not a container.** It holds only: service overview/metadata (including current version), an architecture diagram, links to the component pages that exist for this service, and a **changelog**. All component detail lives on its own page — don't inline API Contract/Kafka/RabbitMQ/etc. content into the Service Tech Doc page itself; that duplicates what the component pages already hold.

**The changelog, not a "Related RFCs" list, is the index's history.** Each row records one notable change — date, version, what changed, which component(s) it touched, and a link to the RFC/PR that introduced it if one exists. This is the versioned record of what changed and when; it isn't a duplicate of RFC content, and not every change needs an RFC behind it (a config tweak or a small fix can just get a changelog row).

**Service Layer is excluded, but a lightweight Business Logic page represents the actual flow.** A full line-by-line restatement of the code still doesn't belong in the Tech Doc — that's what the source file is for. But **Business Logic** is a real component-type page: each entry names the logic, gives a one-line summary of *what* it does, and then represents *how it works* in whatever compact form fits — steps, a formula, a table, or a diagram — cited back to the source file/line range it came from, with an RFC link added only when one exists. The bar is "a new engineer reading this understands the flow without opening the code," not "every line is accounted for."

**Only create the component pages that apply** to a given service — don't create an empty Frontend/UI page for a pure backend service, or an empty Kafka/Queue page for a service with no Kafka messaging, or an empty RabbitMQ/Queue page for a service with no RabbitMQ event bus. A missing page is informative: it means "this service genuinely doesn't have this," not "this wasn't documented yet." Reflect this in the Service Tech Doc's "Component Pages" links list — only list what exists.

**Two different page shapes** depending on component type:
- **Entry-type pages** (API Contract, Business Logic, Kafka/Queue, RabbitMQ/Queue, Background Process, Integration, Frontend/UI): a plain page with a heading, populated with repeated entries — one entry per endpoint/logic-unit/topic/exchange/process/system/screen. New things found later get appended as new entries on the same page.
- **Bulk-type pages** (Data Model, Config): a single page per service, not one page per item. Data Model = one Mermaid ERD covering all owned tables + a description block per table underneath. Config = one table listing every flag/setting as a row. Don't create a separate page or heading block per table or per config key.

## Component taxonomy and entry fields

### API Contract (entry-type page)
One entry per exposed or consumed endpoint.
- Endpoint (method + path)
- Direction (exposed / consumed)
- Request schema (key fields, types) — as a JSON code block
- Response schema (key fields, types) — as a JSON code block
- Auth (mechanism, required scopes/roles)
- Consumers/callers (if known — link to the calling service's Integration entry)

### Business Logic (entry-type page)
One entry per significant piece of business logic worth surfacing — a compact, faithful representation of the flow (not the full code, not a vague pointer either). Only add an entry when the logic is non-obvious and worth a reader knowing it exists (e.g. promo eligibility calculation, role-based access control) — routine CRUD or trivial validation doesn't need an entry.
- Name (e.g. "Promo Eligibility Calculation", "Role-Based Access Control")
- Summary (one line — what it does, not how)
- Trigger/entry point (which API Contract endpoint or Background Process invokes this)
- **How it works** — the actual logic, represented in whichever form fits it best: numbered steps for a sequential process, a formula/pseudocode block for a calculation, a table for rule/condition mappings (e.g. role → permissions), or a Mermaid flowchart/decision-tree for branching logic. Pick the representation the logic actually has — don't force a calculation into prose or a decision tree into a formula. This is a compressed, faithful representation of the real logic (accurate, not hand-wavy), not the full algorithm line-by-line and not a marketing-style summary either.
- Source (file path + line range this was derived from — provenance for the "How it works" section above)
- Full detail (link to the RFC that designed it, only if one exists — most business logic won't have one, and that's expected, not a gap)
- Notable constraints/invariants, if any (e.g. "must stay company-agnostic", "must be idempotent")

### Kafka/Queue (entry-type page)
One entry per Kafka topic the service touches via WolverineFx.
- Topic name
- Direction (consume / produce / both)
- Payload schema (key fields) — as a JSON code block
- Consumer group / Wolverine GroupId (if consuming)
- Retry/DLQ behavior (Wolverine error handling policies)
- Triggering condition (if producing — what causes this event to fire)

### RabbitMQ/Queue (entry-type page)
One entry per RabbitMQ exchange/queue the service touches via EventHelper.
- Exchange name
- Routing key / Queue name
- Direction (publish / subscribe / both)
- Payload schema (key fields) — as a JSON code block
- Retry behavior
- Triggering condition (if publishing — what causes this event to fire)

### Background Process (entry-type page)
One entry per cron job, fire-and-forget job, or long-running process.
- Name (the Hangfire job ID, e.g. `data-transformation`, `invalidate-expired-price`)
- Trigger type (recurring / fire-and-forget / continuation)
- Framework: **Hangfire** (`IRecurringJobManager` for scheduled jobs, `IBackgroundJobClient` for fire-and-forget)
- Schedule (if recurring — cron expression, e.g. `0 3,7,9,14,16 * * *`, plus timezone)
- Storage backend (e.g. PostgreSQL schema `hangfire_product`)
- Responsibility (one line — what it does)
- Distributed lock (if applicable — e.g. `DistributedLockTimeoutException` pattern to prevent concurrent runs)
- Idempotency notes (if relevant — can it safely re-run?)

### Data Model (bulk page, one per service)
A single Mermaid ERD covering every table this service owns, followed by a description section per table underneath the diagram (not a separate page or template instantiation per table).
- ERD: `erDiagram` block with all owned tables and their relationships
- Per table: key fields (SQL-style code block), relationships, migration/ownership notes, source file
- Tables the service merely reads via another service's API don't belong here — only tables it owns

### Integration (entry-type page)
One entry per outbound call to an external or other-internal-service system.
- System name (e.g. SAP, a sibling service, a third-party API)
- Protocol (REST, Kafka, direct DB, etc.)
- Auth (if applicable)
- Failure handling (retry, fallback, silent failure — whatever's actually true)
- Link to the called side's own API Contract/Kafka entry if it's an internal service

### Config (bulk page, one per service)
A single table listing every feature flag and environment-scoped setting that changes this service's behavior — one row per key, not a section per key.
- Columns: Key, Purpose, Scope (env-specific / global), Default/Example, Who sets it

### Frontend/UI (entry-type page)
One entry per page/screen (not every component — only ones worth documenting).
- Page/screen name + route
- Key components worth noting (reusable, non-trivial ones only)
- API Contracts consumed (link to entries above)
- State management approach (if notable)
- Notable business/UX logic (conditional rendering, validation rules)

## Step 1 — Determine scope before doing anything

Before generating or updating a Tech Doc, confirm:
1. **Which service** — a Tech Doc is per-service, not per-repo-if-monorepo and not per-system. If the repo contains multiple services, ask which one(s), or scope to what's in the current working directory/target path.
2. **Full generation vs. targeted update vs. version-driven update** — "generate the tech doc" (from scratch, every applicable component page) is different from "update the Kafka page" (a known, manually-scoped change — read only what's needed, touch only that page) which is different again from "there's a new version, update the docs" (scope determined by diffing from the last documented tag — see Step 1b). Don't regenerate pages the user didn't ask about, or that the diff shows as unchanged, when doing an update — this avoids clobbering hand-edited content with agent output and avoids wasted re-reads.
3. **Does a Tech Doc for this service already exist in Strand?** Search first (`strand:search_pages`) before creating — don't create duplicate pages, either for the Service Tech Doc index or for any component page.

If scope is ambiguous (e.g. user says "document NAOMI" but NAOMI has multiple services), ask which service(s) rather than guessing.

## Step 1b — Version-driven update (diff from the last documented tag, not a full re-scan)

When the trigger is "there's a new version, update the docs" (rather than a specific known change like "add a Kafka topic"), don't re-read the whole repo. Use the Changelog as the anchor and diff from there:

1. **Find the last-documented tag.** Open the Service Tech Doc index and read the most recent Changelog row's Version column — that's the tag the doc currently reflects.
2. **Diff against the new tag.** Run `git diff <last-documented-tag>..<new-tag> --stat` (or `--name-only`) to get the changed file list, then `git log <last-documented-tag>..<new-tag> --oneline` for commit context. This is the scope of what might need updating — everything outside this diff is already accurately documented and shouldn't be re-touched.
3. **Classify the changed files by component type**, using the same signals as Step 2 (a changed `*Controller.cs` → API Contract, a changed `HangfireJobScheduler.cs` → Background Process, a new migration → Data Model, etc.). This tells you which component pages actually need a look, not all eight.
4. **Re-read only the changed files in full** (not the whole surrounding module) to see what actually moved — a changed line count doesn't mean the documented behavior changed; confirm before editing.
5. **Patch only the affected component pages** — for an entry-type page, update or append the specific entry that changed; don't rewrite the whole page. For Data Model/Config (bulk pages), edit just the affected table/row, keeping the rest of the page untouched.
6. **Update the Service Tech Doc index**: bump "Current version" to the new tag, and add one Changelog row summarizing the release — what changed, which component page(s) were touched, version, date, and an RFC/PR link if one exists (see Step 4's note on versioning: don't hand-increment, re-derive the tag the same way as generation).

If there's no prior Changelog row (first-ever update after initial generation with no version yet recorded), fall back to a full Step 2 read once, then this diff-based flow applies from the next update onward.

## Step 2 — Reading the repo to extract each component type

When spawned as an agent against a codebase, use these signals to find each component type. This list is a starting heuristic, not exhaustive — adapt to the actual framework/language found.

- **API Contract**: controller classes (`*Controller.cs` with `[ApiController]` attribute), route attributes (`[HttpGet]`, `[HttpPost]`, `[Route]`), OpenAPI/Swagger specs via Swashbuckle. Look for both what the service exposes AND any outbound HTTP client calls via Refit interfaces (`I*Api.cs`) or `HttpClient` (those may instead belong under Integration if calling another internal/external system).
- **Business Logic**: business classes (`*Business.cs`) with non-trivial calculation or decision logic (pricing/promo engines, eligibility checkers, transformation logic, product grouping rules). Don't enumerate every business class — only ones a new engineer would need pointed out. For each, trace the actual logic and represent it compactly in the "How it works" field using whichever format matches its shape: a numbered-step sequence for a multi-stage lookup/process, a formula or short pseudocode block for a calculation, a table for a rule/condition mapping (e.g. role → allowed actions), or a Mermaid diagram for branching/decision logic. Read enough of the code to represent it faithfully — this is more than a citation, but still compressed, not a full restatement of every line. Most business logic won't have an RFC behind it (it predates this Tech Doc effort, or was never big enough to warrant one) — that's expected, not a gap to flag; only add an RFC link when one genuinely exists via `strand:search_pages`. The Source field (file + line range) is always required as provenance for what's in "How it works," separate from the optional RFC link.
- **Kafka/Queue**: WolverineFx Kafka configuration in `DependencyInjection.cs` (`UseKafka`, `ListenToKafkaTopic`), message handler/consumer classes (`*Consumer.cs`, `*Handler.cs` in `Controllers/MessageHandler/`), message model classes in `Messages/` directory (with `[Wolverine.Attributes]`), topic name constants, producer calls via Wolverine's `IMessageBus`.
- **RabbitMQ/Queue**: `EventHelper` setup and usage (exchange name, routing key, queue name), RabbitMQ connection config (`rabbit_url`, `rabbit_EventBus`, `rabbit_eventQueueName` in `AppConfig`), event publish calls via `IEventHelper`, subscriber registrations.
- **Background Process**: Hangfire job registrations in `HangfireJobScheduler.cs` (`IRecurringJobManager.AddOrUpdate<T>` with cron expressions and timezone), fire-and-forget jobs via `IBackgroundJobClient.Enqueue`, job handler classes (e.g. `TransformationJobHandler`), Hangfire configuration in `DependencyInjection.cs` (`AddAppHangfire`), distributed lock patterns (`DistributedLockTimeoutException`).
- **Data Model**: EF Core entity classes (`Entities/` directory), migration files (`Migrations/`), `DbContext` classes (`AppDbContext`, `ImporterDbContext`), MongoDB collections if applicable. Trace foreign keys and navigation properties across all owned tables to assemble the ERD, not just document tables in isolation.
- **Integration**: Refit interface definitions (`I*Api.cs`) and their `AddRefitClient<>()` registrations in `DependencyInjection.cs`, direct `HttpClient` usage, SDK initializations for third-party services (e.g. AWS S3), hardcoded or config-driven external base URLs.
- **Config**: `appsettings.json` / `appsettings.*.json`, `AppConfig.cs` class (strongly-typed configuration), `.env` / `.env.example`, environment variables bound via `IConfiguration`, feature flags or runtime toggles.
- **Frontend/UI**: route/page definitions in the frontend framework (if applicable — many .NET services are pure backend APIs with no frontend). If frontend exists, look for API call sites to reverse-map which API Contract entries are consumed.

**Versioning (Overview table's "Current version" field)**: for .NET services with a `<Version>` property in the `.csproj` file or an `AssemblyVersion` attribute, use that version field. For services without an explicit version property, derive the version from the **latest git tag** instead of introducing a new version file: run `git describe --tags --abbrev=0` (or list tags and take the highest semver) in the repo. If no tags exist at all, leave the field blank rather than guessing or defaulting to `0.1.0` — an empty field is honest, a fabricated version isn't. Don't ask the user to add a tag or a version file as a precondition for generating the rest of the Tech Doc; versioning gaps affect only that one field, not the whole run.

**Do not fabricate entries.** If a component type search turns up nothing, that page is genuinely absent for this service — don't create it, and don't link it from the Service Tech Doc index (see Structure section above).

**Cite the source** for each entry (file path, or file path + line range) so a human can verify — this matters more than prose polish, since the doc's value is traceability back to actual code.

**Populate code blocks with real content, not placeholders.** The templates render request/response/payload schemas, ERDs, SQL key fields, and config values as actual fenced/mermaid code blocks. When writing an entry, replace the placeholder inside the block with the real schema/DDL/diagram/value pulled from the repo — don't leave `{}`, `value_here`, or the sample `TABLE_ONE`/`TABLE_TWO` ERD nodes in place, and don't collapse a block back into inline prose.

**When a schema can't be fully resolved** (e.g. a Kafka payload's class lives in another repo, or a type is referenced but not defined locally), the code block still only holds real schema syntax — never a prose explanation in place of one. Put what's actually known as partial fields inside the block (even just the top-level structure or field names without types), and put the "why it's incomplete" note as a separate line of prose *outside* the code block, e.g. a one-line "Schema partial — full type defined in `KLG.Backend.Product.Models.Message.Hierarchy`, an external project not available to this read" underneath. Never write a bare description string as if it were the schema — `{ "note about the class" }` is not valid content for a schema code block under any circumstance.

## Step 3 — Draft before writing

Compile findings into a draft (in your response, or as a scratch artifact) organized by component page before writing anything to Strand. This lets the user review/correct before it lands in the shared doc — especially important for an agent run against a large repo, where misclassified entries (e.g. an internal service call miscategorized as Integration vs. API Contract) are easy to make silently.

**Draft in the entry template's field structure from the start, not in prose.** Fetch each relevant entry template (`get_template`) before drafting that section, and write each finding directly as a filled-in copy of the template's fields — not as a paragraph summarizing what was found. Converting prose into structured fields after the fact tends to lose or blur field boundaries (e.g. auth and failure-handling merging into one sentence); drafting field-first avoids that entirely.

## Step 4 — Writing to Strand

Reference `office-config/platform-notes.md` for live environment IDs and MCP tool names before writing. Key points to re-verify each time, since these can drift:
- Confirm the target space and parent page ID via `strand:search_pages` / `strand:list_pages` rather than assuming a cached ID is still correct.
- Strand URL slugs are not the same as internal UUIDs — resolve the real UUID via `get_page` before calling `update_page`.

**Known workspace-level template IDs** (created in Strand; re-verify via `strand:list_templates` if a call fails, since these can be recreated/changed):

| Template | Shape | ID |
|---|---|---|
| Service Tech Doc | page-level, one per service (lean index + changelog) | `01a08e5d-b017-7d1b-94cd-5992e208c938` |
| API Contract Entry | entry-level, repeated on the API Contract page | `01a08a36-6bed-7bb2-989b-f464718dbbbd` |
| Business Logic Entry | entry-level, repeated on the Business Logic page — "How it works" represented as steps/formula/table/diagram, cited to source | `01a08e61-c729-7442-bc74-f53d9ddaa9d1` |
| Kafka/Queue Entry | entry-level, repeated on the Kafka/Queue page (WolverineFx + Kafka topics) | `01a08a36-75a1-7533-bec5-597500d88175` |
| RabbitMQ/Queue Entry | entry-level, repeated on the RabbitMQ/Queue page (RabbitMQ event bus via EventHelper) | `01a0cc3c-c113-73c3-bd05-15c407a3a285` |
| Background Process Entry | entry-level, repeated on the Background Process page (Hangfire recurring/fire-and-forget jobs) | `01a08a40-257a-7ce1-9d4d-2ca827fada21` |
| Data Model | page-level, one per service (ERD + per-table sections) | `01a08a40-4e80-7533-b3ea-0e31bbab3bf8` |
| Integration Entry | entry-level, repeated on the Integration page | `01a08a36-9a93-7dbe-bbc4-5bc17155960c` |
| Config | page-level, one per service (bulk table) | `01a08a40-3451-725a-8626-f4c4c6222804` |
| Frontend/UI Entry | entry-level, repeated on the Frontend/UI page | `01a08a36-b7c0-78e1-87d4-c2f94e53ded5` |

Procedure:
1. If the **Service Tech Doc** index page doesn't exist yet for this service, create it via `create_page_from_template` (template `01a08e5d-b017-7d1b-94cd-5992e208c938`), parented under the system's index page.
2. For each applicable component type, create its page as a **child of the Service Tech Doc index**:
   - **Data Model** and **Config**: create directly from their page-level template (`create_page_from_template`) — these are used once per service.
   - **API Contract, Business Logic, Kafka/Queue, RabbitMQ/Queue, Background Process, Integration, Frontend/UI**: create a plain page (via `create_page`) titled after the component type. **Before writing any entry, call `get_template` on that component's entry template ID and treat its exact field list as a mandatory checklist** — every entry must use the same field labels, in the same order, as headings/bold-labels, not summarized into prose. Free-form paragraphs describing an endpoint ("this service exposes an endpoint that lets callers...") are a failure mode, not an acceptable substitute — if a field's value is unknown, write the field with "Unknown" or leave it blank, don't omit the field or fold it into narrative text. Build each entry by copying the fetched template's structure and filling in real values, then append entries one after another on the page. For Business Logic specifically, keep the Summary field to one line — if the draft summary runs past a sentence, that's a sign it's drifting into a restatement of the logic and should be trimmed back to "what" with a link out for "how."
3. Update the Service Tech Doc index's "Component Pages" section to link to whichever pages were actually created — omit links for component types this service doesn't have.
4. Add a row to the Service Tech Doc's **Changelog** table for any notable change — first generation counts as one entry per component area populated (or a single "Initial Tech Doc generated" row), and every later update gets its own row: date, version, what changed, which component page(s) it touched, and a link to the RFC/PR if one exists. For the Version column, re-derive it the same way as the Overview field (latest git tag, or manifest version if one exists) rather than incrementing by hand — if the tag hasn't moved since the last changelog row, repeat the same version rather than inventing a bump.
5. For a **targeted update** (e.g. "add a new Kafka topic", or the component pages identified by Step 1b's diff), fetch the existing component page, update or append the entry in the same format as existing ones, and write back — don't touch the Service Tech Doc index's Component Pages/Architecture sections unless the update affects them too, but do add the Changelog row.
6. For Data Model updates specifically: update both the ERD block (add the new table/relationship) and add its description section — the two must stay in sync.

## Step 5 — Cross-linking

When an entry references another service (e.g. Service A's Integration entry calls Service B's API), link to Service B's actual Tech Doc page/entry rather than restating its details. This is what keeps the doc set from drifting out of sync — details live in exactly one place.

## Notes on relationship to RFCs and versioning

- An RFC documents *why* and *how* a specific initiative was designed — narrative, tradeoffs, decisions.
- A Tech Doc component entry documents *what currently exists* — factual, current-state, no narrative.
- The Service Tech Doc's **Changelog** documents *what changed and when* — the versioned history. It's the bridge between the two: a changelog row can point back to the RFC that motivated a change, but the row itself is a fact about the Tech Doc's own history, not a copy of the RFC.
- When closing out an RFC, the expected follow-up is: extract the concrete components it introduced/changed, add/update the corresponding Tech Doc entries, and add a Changelog row summarizing the change with a link back to the RFC. Don't copy the RFC's prose into either the component entries or the changelog.
- Not every changelog row needs an RFC — small fixes, config changes, or minor corrections can be logged directly without one.
