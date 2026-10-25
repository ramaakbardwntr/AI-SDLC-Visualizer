---
name: dotnet-standards
description: Coding standards for .NET 6/8/10 in this office (LINQ, Entity Framework, class models, readable and maintainable business logic) adhering to project-specific TFM, LangVersion, and code style. Use whenever writing, modifying, or reviewing C# code.
---

# .NET Standards

Core principle: **the project profile overrides these general guidelines.** These guidelines apply to aspects not explicitly specified by the project profile.

## Match Target Framework & Language Version
| TFM | Default C# | Notes |
|---|---|---|
| net6.0 | C# 10 | File-scoped namespaces, `record`, global usings OK. No primary constructors, no collection expressions, no `required`. |
| net8.0 | C# 12 | Primary constructors, collection expressions, `required` OK **only if** the project's style already uses them. |
| net10.0 | C# 14 | New features allowed only when `LangVersion` and project style explicitly permit. |

Check `LangVersion` in `.csproj`. Never use features beyond the project's `LangVersion`. For legacy projects (.NET Framework, older conventions): make minimal surgical changes following surrounding patterns; do not "modernize" code outside the approved plan.

## Readable Business Logic
- Single responsibility per method; method names must reflect business intent (`CalculatePromoEligibility`, not `Process`).
- Use guard clauses and early returns; avoid deeply nested logic. Separate "validation", "calculation", and "persistence".
- Named business rules should be encapsulated in small methods/classes, not sprawling `if` blocks. Magic numbers and strings must be `const`, enums, or configuration values.
- Complex conditions should be extracted into named boolean variables or predicate methods (`isEligible`).
- Comments should explain *why*, not *what*.

## LINQ
- Use LINQ for collection transformations, filtering, and aggregations; choose the most expressive operator (`Any` instead of `Count() > 0`, `FirstOrDefault` with null check, `ToDictionary`, `GroupBy`).
- Never conceal side effects inside `Select` or `Where`. Avoid multiple enumeration (materialize with `ToList()` when reused).
- Break down lengthy queries into named intermediate steps rather than a single chained pipeline of 12 operators.

## Entity Framework Core
- Read queries: use `AsNoTracking()`; project directly to DTOs via `Select` instead of loading entire entity graphs.
- Filter at the database level (`Where` before `ToListAsync`), not in memory. Prevent N+1 queries: use `Include`/projections, never query inside a loop.
- Writes: mutate entities, perform one `SaveChangesAsync` per unit of work. Use transactions only when multi-step atomicity is strictly required.
- Always async with `CancellationToken` if the project follows that pattern. Never call `.Result` or `.Wait()`.
- Global query filters / soft delete (`IsDeleted`): follow existing project conventions; do not omit when authoring raw/custom queries.
- Schema changes: follow the project's approach (migrations or manual SQL scripts). Refer to `pr-description-generator` for PostgreSQL Database Changes Query.

## Class Models
- Keep Entities, DTOs (Request/Response), and Messages separated. Do not return database entities directly from API controllers if the project uses DTOs.
- Required non-nullable properties must be properly initialized/annotated (respect the project's `Nullable` setting). Avoid `object` or `dynamic` without a concrete justification.
- Use enums for statuses; convert to strings only at boundaries (DB/API) following existing conventions.

## Error Handling and Logging
- Follow project patterns (custom exceptions, result wrappers, global filters). Never swallow exceptions without logging.
- Use structured logging (`{OrderId}`), omitting any sensitive data, secrets, or PII.
- External calls: implement timeouts, retries, and fallbacks as per project patterns; never mark a transaction as failed if the outcome is uncertain (refer to inquiry patterns in RFC payment integrations).

## Dependencies and Integrations
- Rely on constructor injection; declare interfaces for external clients (enabling mocking in tests), while using real repository implementations in tests.
- Do not add new NuGet packages without explicit approval in the plan.

## Pre-submission Checklist
- [ ] Clean `dotnet build` with no new warnings.
- [ ] Conforms to `.editorconfig` (`dotnet format --verify-no-changes` if adopted by team).
- [ ] No dead code, unexplained `TODO` comments, or scope creep outside the plan.
- [ ] Naming, namespaces, and folder structure match surrounding project conventions.
