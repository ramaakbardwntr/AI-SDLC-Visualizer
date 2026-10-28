---
name: profile-<project>
description: Project reference profile for <project> (<type>, <tfm>). Read by all agents prior to executing tasks in this repository to conform to established architecture, conventions, testing patterns, and guardrails.
project: <project>
repo: <owner/repo>
type: microservice | monolith | legacy     # requires user confirmation
tfm: net6.0 | net8.0 | net10.0
lang_version: <default or value in csproj>
base_branch: main | master
scanned_commit: <hash>
scanned_at: YYYY-MM-DD
status: draft | confirmed
---

# Project Profile: <project>

## 1. Identity
| Item | Value | Evidence |
|---|---|---|
| Type | | |
| Main Solution / Project | | |
| TFM & LangVersion | | |
| Nullable / ImplicitUsings | | |

## 2. Layer Map
| Layer | Location | Notes |
|---|---|---|
| Controller / Endpoint | | |
| Service / Business | | |
| Repository / Data Access | | |
| Entity / Model | | |
| DTO / Request / Response / Messages | | |
| Helper / Utility | | |
| Migrations / SQL Scripts | | |

## 3. Code Conventions
- Naming and Structure:
- Dependency Injection (registration files & lifetimes):
- Mapping / Validation / Mediator:
- API Response Format & Error Handling:
- Logging:
- Permitted C# Language Features:
- Disallowed C# Language Features:

## 4. Data Layer
- ORM & Version:
- DbContext (name, location) & Provider:
- Database Schema & Table/Column Naming Conventions:
- Migrations: Present / Absent (how schema changes are applied):
- Base Entities / Audit Columns:

## 5. Integrations & Background Processing
| Type | Detail | Evidence |
|---|---|---|
| Kafka (WolverineFx) | | |
| RabbitMQ (EventHelper) | | |
| Hangfire | | |
| Outbound Calls (Refit / HttpClient / SDK) | | |
| Configuration (appsettings / AppConfig / env) | | |

## 6. Testing
- Test Project Path:
- Test Framework / Mock Library / Assertion Library:
- Test Database Strategy (Real DB? Connection string source? Safe for isolated runs?):
- Existing Seeder & Cleanup Patterns:
- Test Class Naming Conventions:
- Filtered Test Command:
  ```bash
  dotnet test <path.csproj> --filter "FullyQualifiedName~<TestClassName>"
  ```
- Representative Test Pattern Example (max 40 lines):
  ```csharp
  ```
- Note: Record `No test project found` if the repository lacks automated tests.

## 7. Git & CI
- Primary Base Branch:
- Branch Naming Patterns (reference only; task branch name always provided by user):
- CI Workflows & PR Template:

## 8. Docmost
- Service Tech Doc Page ID: <page-id | None>
- Relevant Components: API Contract, Business Logic, ... (only components actually present)

## 9. Guardrails
1. 
2. 

## 10. Open Questions
- 

