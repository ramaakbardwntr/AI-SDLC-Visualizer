---
name: docs-sync
description: Optional documentation workflow - handles on-demand Tech Doc and RFC updates in Strand/Docmost via MCP only when requested by the user with specified Space and target doc/URL.
---

# Docs Sync (Optional / On-Demand)

This skill governs **when and how** documentation is created or updated in Strand / Docmost. The content format adheres strictly to `tech-doc-generator` (Tech Docs) and `docmost-rfc-generator` (RFCs).

> [!NOTE]
> **Optional Workflow:** Documentation updates to Strand / Docmost are **optional**. The agent must never enforce or trigger automatic documentation updates without explicit user consent.

> [!IMPORTANT]
> **User Input Required:** When the user chooses to update documentation, the user **MUST provide**:
> 1. **Target Space name** in Strand / Docmost.
> 2. **Target Document name** or **Strand URL link** of the document to be updated.
> 
> **Language Mandate:** All documentation (Tech Docs, RFCs, and Changelogs) drafted and published to Strand/Docmost via MCP **MUST be written in English**.

## A. Post-Plan Offer & Decision Flow
At the conclusion of every implementation plan or prior to release, offer to the user:
> *"Would you like to update the related Tech Doc or RFC on Strand Docmost MCP? If yes, please provide the target Space name and document name (or Strand URL link)."*

| User Decision | Action |
|---|---|
| **No / Skip / Not needed** | Skip all Docmost creation and updates entirely. Record in brief/report: `Docs skipped per user decision`. Proceed immediately to the next phase. |
| **Yes (with Space & Doc/URL provided)** | Proceed with drafting the Tech Doc or RFC according to the specifications below. |
| **Yes, but Space/Doc omitted** | Prompt the user to provide the Space name and document name/URL before calling MCP tools. Do not guess spaces or documents. |

---

## B. RFC (Optional - Design for New Initiatives)
1. Executed only when approved by the user for new features.
2. Use `search_pages` within the Space provided by the user to verify if a related RFC already exists.
3. When creating a new RFC: follow `docmost-rfc-generator` in English (Mermaid code blocks, GFM tables, RFC ID format `RFC-YYYY-NNN`).
4. Never fabricate details; state gaps as `Needs confirmation`.

---

## C. Tech Doc (Optional - Living Technical Reference)
1. **Verify Target:** Confirm target Space and parent page ID based on the user's input Space and document name/URL.
2. **Classify Changes:** Map changes from `git diff` to component types (Controller $\rightarrow$ API Contract, Business Logic, Kafka, RabbitMQ, Hangfire $\rightarrow$ Background Process, Entity/Migration $\rightarrow$ Data Model, Refit $\rightarrow$ Integration, AppConfig $\rightarrow$ Config).
3. **Drafting:** Author entry drafts in English into `.office/tasks/<id>/docs-draft.md` adhering to the corresponding component entry templates.
4. **Review (Gate 2):** Present the draft alongside the diff review and test report.
5. **Write via MCP:** Upon approval, update the target document in Strand MCP using `update_page` or `create_page_from_template`.

---

## D. Failure Conditions & Guardrails
- If MCP is unreachable or fails: mark status as blocked and report to the user without halting code implementation.
- Never publish secrets, connection strings, passwords, tokens, or personal identifiable information (PII) to Docmost.
- All published content in Strand Docmost must remain strictly in English.
