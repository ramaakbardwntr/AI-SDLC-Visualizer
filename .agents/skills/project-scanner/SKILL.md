---
name: project-scanner
description: Scan a .NET repository (6/8/10; microservice, monolith, or legacy) and generate a project profile at project-profiles/<project>/SKILLS.md covering architecture, conventions, testing setup, and guardrails. Use whenever the user requests "scan project", "create project profile", "learn this repo", or when starting a task on a project that lacks a profile.
---

# Project Scanner

Goal: enable other agents to work in this repository **without deviating from established conventions**. The profile must contain verifiable facts with file paths, not assumptions. The repository is strictly read-only during scanning.

## Execution Steps

### 1. Preparation
```bash
git -C workspace/<repo> rev-parse --abbrev-ref HEAD
git -C workspace/<repo> rev-parse --short HEAD          # record as scanned_commit
git -C workspace/<repo> ls-remote --symref origin HEAD  # base branch (main/master)
git -C workspace/<repo> log -n 15 --pretty=format:"%h | %an | %ad | %s" --date=short
```

### 2. Identity and Architecture
- Solution/project list: `find workspace/<repo> -name "*.sln" -o -name "*.csproj" | grep -v -E "/(bin|obj)/"`.
- TFM and language: `TargetFramework(s)`, `LangVersion`, `Nullable`, `ImplicitUsings` in `*.csproj` and `Directory.Build.props`; check `global.json`. Note mixed TFMs across projects.
- Classification (always flag as **needs user confirmation**):
  - **microservice**: single deployable unit with bounded domain scope, messaging/Refit integrations to peer services, single DbContext.
  - **monolith**: multiple domains/modules in a single deployable, controllers spanning domains, large unified DbContext.
  - **legacy**: one or more of: .NET Framework/`packages.config`/`web.config`/`Global.asax`, scattered ADO.NET/raw SQL, lack of DI, oversized classes (>1000 lines), static helpers, sync-over-async, lack of automated tests.
- Layer map: identify folders/projects containing Controllers, Service/Business logic, Repositories, Entities/Models, DTOs/Messages, Helpers, and Migrations.

### 3. Code Conventions (Extract from 3-5 representative files, never just one)
- Naming conventions, async suffix, API return types (wrapper response? `ActionResult<T>`? exception filters?).
- Dependency Injection: registration roots (`DependencyInjection.cs`, `Program.cs`, `Startup.cs`), standard lifetimes.
- Object mapping (AutoMapper/Mapster/manual), validation (FluentValidation/DataAnnotations), mediator patterns (MediatR/Wolverine), logging (Serilog/ILogger), error handling.
- `.editorconfig`, analyzers, and `dotnet format` configuration.

### 4. Data Layer
- ORM (EF Core version, Dapper, ADO.NET), DbContext (name, location), database provider (PostgreSQL?), schema conventions, table/column naming rules.
- **Migrations**: present or absent (do not assume). If absent, identify how schema changes are managed (manual SQL scripts?).
- Audit columns / base entities (`created_by`, `created_at`, `updated_by`, `updated_at`, `version`).

### 5. Integrations and Background Processing
- Messaging: WolverineFx + Kafka (`UseKafka`, `ListenToKafkaTopic`), RabbitMQ via `EventHelper`.
- Background processing: Hangfire (`HangfireJobScheduler`, `AddOrUpdate`, `Enqueue`).
- Outbound calls: Refit (`I*Api.cs`, `AddRefitClient`), direct `HttpClient`, third-party SDKs.
- Configuration: `appsettings*.json`, `AppConfig.cs`, environment variables, feature flags.
Reference `tech-doc-generator` Step 2 for comprehensive signals to ensure profile alignment.

### 6. Testing (Critical section for the `qa` agent)
- Test project: path, framework (xUnit/NUnit/MSTest), mock library (Moq/NSubstitute), assertion library.
- **Database strategy in tests**: real database (local PostgreSQL/Testcontainers), InMemory, SQLite? Where does the test connection string originate? Verify it is **not** a shared/production DB.
- Existing seeder and cleanup patterns (IAsyncLifetime, fixtures, `Seed*` helpers). Copy **one** representative test (max 40 lines) into the profile as a `Test Pattern Example`.
- Filtered test execution command, and naming conventions (`OrderService` -> `OrderServiceTests`).
- If no test project exists: record `No test project found` explicitly.

### 7. Git and Docmost
- Main branch, naming conventions observed in `git branch -r` (reference only; task branch name always comes from user).
- CI workflows (`.github/workflows`), PR template (`.github/pull_request_template.md`).
- Search for Service Tech Doc page in Docmost via MCP (`search_pages`) and record page ID if found. If none exists, record `None`.

### 8. Guardrails
Record 5-10 specific "DO NOT" rules based on repository evidence (e.g. "Do not modify `LegacyPriceHelper`, used in 14 places without tests", "All entities must inherit `AuditableEntity`", "Do not use C# `record` syntax due to LangVersion 9").

### 9. Write Profile
Copy `project-profiles/_template/SKILLS.md`, fill all sections, and save to `project-profiles/<project>/SKILLS.md` with `status: draft`. Add/update the project entry in `office.config.yml`. Sections where no information was found must be written as `Not found`, never omitted. Ambiguities belong under **Open Questions**.

## Validation Checklist Before Completion
- [ ] Every claim has a supporting file path citation.
- [ ] TFM, LangVersion, and permitted C# features are consistent.
- [ ] Testing section provides sufficient detail to author tests without re-scanning the repo.
- [ ] No secrets or connection strings present (use `<redacted>`).
- [ ] Project classification is explicitly marked as requiring user confirmation.

## Re-scanning (Existing Profile)
- Read the existing profile first. Retain **Guardrails** and user answers in **Open Questions**; append only new findings and flag modifications.
- Update `scanned_commit`, `scanned_at`, and revert status to `status: draft` if changes occurred in TFM, architecture, or test patterns.
