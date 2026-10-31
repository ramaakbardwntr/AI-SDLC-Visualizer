---
name: profile-ai-engineering-office
description: Architectural profile, runtime state schema, conventions, and guardrails for ai-engineering-office (AI SDLC Visualizer). Read before modifying visualizer UI, state synchronization scripts, hooks, or agent workflows.
project: ai-engineering-office
repo: ramaakbardwntr/AI-SDLC-Visualizer
type: monolith-tooling # confirmed: standalone zero-dependency Node.js + HTML5 Canvas platform
tfm: node20.12.2-esm (Node.js >= 18+, Vanilla ES2022 + HTML5 Canvas)
lang_version: ES2022 (ESM .mjs)
base_branch: main
scanned_commit: 7a35aa7
scanned_at: 2026-10-28
status: confirmed
---

# Project Profile & Engineering Reference: `ai-engineering-office`

## 1. Identity & Tech Stack

| Item | Value | Evidence |
|---|---|---|
| **Repository** | `ramaakbardwntr/AI-SDLC-Visualizer` | `.git/config` (`git remote -v`, token `<redacted>`) |
| **Classification** | Standalone developer platform / tooling monolith | `README.md:L1-L6`, `visualizer/index.html`, `tools/*.mjs` |
| **Backend / CLI Runtime** | Node.js `>= 18` (verified `v20.12.2`), native ES Modules (`.mjs`), **zero external npm dependencies** (no `package.json` / `node_modules`) | `tools/serve-visualizer.mjs:L1-L6`, `tools/office-state.mjs:L2` |
| **Frontend Stack** | Single-file HTML5 + CSS3 Grid + 2D `<canvas>` + Vanilla JavaScript (`'use strict'`) | `visualizer/index.html` |
| **Agent Customization Layer** | Antigravity & Claude Code rules, 4 centralized AI Model agents (`argon`, `flash`, `opus`, `sonnet`), slash commands, hooks, and skills | `AGENTS.md`, `.agents/**`, `office.config.yml` |
| **Default Local Port** | `http://127.0.0.1:4177` (configurable via `process.env.PORT`) | `tools/serve-visualizer.mjs:L19,L105` |

---

## 2. Architecture & Module Map

| Layer / Module | Path | Responsibility & Key Internals |
|---|---|---|
| **HTTP Server & Poller** | `tools/serve-visualizer.mjs` | Zero-dependency `node:http` server serving `visualizer/index.html` (`GET /`), live state (`GET /state.json`), chat feed (`GET /chat.json`), model usage (`GET /usage.json`), and mutation endpoints (`POST /reset`, `POST /user`, `POST /usage`). Runs a `1000ms` background `setInterval` calling `syncStateFromTranscript()`. |
| **Transcript Mirror & Inference Engine** | `tools/mirror-transcript.mjs` | Discovers latest Antigravity transcript (`~/.gemini/antigravity/brain/<convId>/.system_generated/logs/transcript.jsonl`), recurses into subagent transcripts (`invoke_subagent`), resolves conversation titles (`~/.gemini/antigravity/annotations/<convId>.pbtxt` or `brain/<convId>/implementation_plan.md`), extracts active project names (`extractProjectFromPath`, `extractProjectFromMetadata`), centralizes workflow on 4 AI Model agents (`argon`, `flash`, `opus`, `sonnet`), accurately infers actions (`inferToolAction`: `Editing` vs `Drafting`/`Writing` vs `Reading` vs `Searching`), computes model usage (`computeModelUsage`), and persists `.office/state.json` & `.office/chat.json`. |
| **IDE Lifecycle Hook Handler** | `tools/office-hook.mjs` | Bridges IDE lifecycle events to `.office/state.json` and `.office/chat.json`. Supports `--source antigravity` (`PreInvocation`, `PostToolUse`, `PostInvocation`) and Claude Code (`UserPromptSubmit`, `PostToolUse`, `SubagentStart`, `SubagentStop`, `Notification`, `Stop`). Dispatches directly to the active AI model agent in English. Wraps all logic in a silent top-level `try/catch` so IDE execution is never disrupted. |
| **Manual State CLI** | `tools/office-state.mjs` | Command-line state controller (`reset`, `dispose`, `task`, `phase`, `agent`, `handoff`, `gate`, `log`, `say`) supporting `argon`, `flash`, `opus`, `sonnet` (with legacy role fallback) and English output. |
| **Hook Installer** | `tools/setup-antigravity.mjs` | Writes absolute-path Antigravity hook definitions (`ai-office-visualizer`) to both `.agents/hooks.json` and `~/.gemini/config/hooks.json`. |
| **2D Canvas & Dashboard UI** | `visualizer/index.html` | Renders a `960x560` logical pixel-art office canvas with 4 AI Model avatars (`Gemini 4 Argon`, `Gemini 3.8 Flash`, `Claude Opus 5.5`, `Claude Sonnet 5.5`, `144px` widened desks, blocked test error bubbles on any avatar) alongside an English status sidebar (Active Task, Agents, Rich-Text Conversation, Activity log) plus an autonomous English `DEMO` simulation mode. |
| **Core Office Rules** | `AGENTS.md`, `.agents/rules/office-visualizer.md` | Defines the 9 Golden Rules, 3 Approval Gates (Gate 1: Plan, Gate 2: Results & Docs, Gate 3: Push & PR), centralized 4-model SDLC workflow, and visualizer state synchronization rules. |
| **Consolidated Agent Personas** | `.agents/agents/*.md` | Consolidated AI model personas: `argon.md`, `flash.md`, `opus.md`, `sonnet.md`. |
| **Reusable Engineering Skills** | `.agents/skills/*/SKILL.md` | 10 domain skills authored in English: `project-scanner`, `implementation-plan`, `dotnet-standards`, `xunit-testing`, `git-workflow`, `docs-sync`, `tech-doc-generator`, `docmost-rfc-generator`, `jira-task-generator`, `pr-description-generator`. |
| **Unit Test Suite** | `tools/mirror-transcript.test.mjs` | Zero-dependency test suite using Node's built-in `node:test` and `node:assert/strict` validating canonical model mapping, `Editing implementation_plan.md` action bubbles without phase regression, and tool routing. |

---

## 3. Code & Engineering Conventions

1. **Zero-Dependency Native Node.js ESM (`tools/*.mjs`)**:
   - All backend/CLI scripts use built-in `node:` prefixed imports (`node:fs`, `node:path`, `node:os`, `node:http`, `node:url`, `node:test`, `node:assert/strict`).
   - Do not add `package.json` third-party runtime dependencies.
2. **Atomic File Writes (Windows Lock Resilience)**:
   - JSON state files (`.office/state.json`, `.office/chat.json`, `.office/config.json`, `.office/usage.json`) are written via `writeJsonSafe(target, obj)`, writing first to `<target>.<pid>.tmp` and renaming over `<target>`, with a direct `fs.writeFileSync` fallback if Windows file locking blocks `renameSync`.
3. **Non-Blocking Hook Execution**:
   - `tools/office-hook.mjs` catches all exceptions silently and writes `{}` to `stdout` when `--source antigravity` is active so a broken transcript or malformed JSON payload never blocks user prompts or tool calls.
   - Internal state scripts (`office-state.mjs`, `office-hook.mjs`, `serve-visualizer.mjs`) are explicitly ignored inside `inferToolAction` to prevent infinite state-update recursion.
4. **Frontend Rendering & XSS Sanitization (`visualizer/index.html`)**:
   - No frontend bundler or external CSS/JS CDN; everything lives in `visualizer/index.html` for instant local startup and offline Demo Mode support.
   - Rich-text chat rendering (`renderRich`) stashes fenced/inline code blocks first, runs `escHtml()` across all input, and selectively re-enables only attribute-free inline formatting tags (`SAFE_TAGS`) and `http(s):`/`file:` links.
   - Canvas rendering scales crisply across HiDPI screens (`dprNow()` capped at `3`, `ResizeObserver` computing `--u` CSS scale ratio against `W = 960, H = 560`) and honors `prefers-reduced-motion: reduce`.
5. **Bounded Payload & Log Sizes**:
   - Activity logs retain the latest `100` entries, handoff queues retain the latest `20` flight events, and chat messages retain the latest `100` user/assistant entries with `rawForChat` capped at `1500` characters.

---

## 4. Runtime Data & State Layer (`.office/`)

| File / Path | Purpose & Key Fields |
|---|---|
| `.office/state.json` | Live visualizer state: `task` (`{ id, title, project, branch, mode }`), `phase` (`intake \| profile \| plan \| gate1 \| branch \| code \| test \| docs \| gate2 \| release \| done`), `gate` (`{ n, question } \| null`), `activeAgent` (`argon \| flash \| opus \| sonnet`), `agents` (`Record<'argon'|'flash'|'opus'|'sonnet', { status, message }>`), `handoffs` (`Array<{ n, from, to, label, at }>`), `handoffSeq`, `log` (`Array<{ at, text }>`), `turn`, `userName`, `clearedAt`, `transcriptSync`, `updatedAt`. |
| `.office/chat.json` | Mirrored conversation feed: `{ seq, messages: Array<{ n, role, agent?, at, text, md }> }`. |
| `.office/config.json` | Persistent user preferences across restarts: `{ userName }`. |
| `.office/usage.json` | Custom quota configuration per AI model (`Gemini 4 Argon`, `Gemini 3.8 Flash`, `Claude Opus 5.5`, `Claude Sonnet 5.5`). |
| `.office/tasks/<task-id>/` | Per-task SDLC artifacts: `brief.md`, `plan.md`, `test-report.md`, `docs-draft.md`, `jira.md`, `pr.md`. |

---

## 5. Integrations & External Touchpoints

| Integration | Mechanism | Evidence |
|---|---|---|
| **Antigravity IDE / CLI** | Reads `~/.gemini/antigravity/brain/<convId>/.system_generated/logs/transcript.jsonl` & `~/.gemini/antigravity/annotations/<convId>.pbtxt`; hooks registered in `.agents/hooks.json` & `~/.gemini/config/hooks.json`. | `tools/mirror-transcript.mjs`, `tools/setup-antigravity.mjs` |
| **Claude Code CLI** | Lifecycle hooks configured in `.agents/settings.json`. | `.agents/settings.json`, `tools/office-hook.mjs` |
| **Strand / Docmost MCP** | Configured via `.mcp.json` (template at `.mcp.json.example`); MCP tool calls trigger Docmost prop handoffs. | `office-config/platform-notes.md`, `tools/mirror-transcript.mjs` |
| **GitHub & Jira Props** | Canvas props animate when `git checkout -b`, `git commit`, `git push`, `gh pr`, `pr.md`, `pr.html`, or `jira.md` operations are detected. | `tools/mirror-transcript.mjs`, `visualizer/index.html` |

---

## 6. Testing & Verification

- **Automated Test Project**: Verified via built-in `tools/mirror-transcript.test.mjs` (`11/11 tests passing`):
  ```powershell
  node --test tools/mirror-transcript.test.mjs
  ```
- **Standard Verification Commands**:
  1. **Syntax check all Node ESM scripts**:
     ```powershell
     node --check tools/mirror-transcript.mjs
     node --check tools/office-hook.mjs
     node --check tools/office-state.mjs
     node --check tools/serve-visualizer.mjs
     node --check tools/setup-antigravity.mjs
     ```
  2. **Extract and syntax-check inline script in `visualizer/index.html`**:
     ```powershell
     node -e "const fs=require('fs'),h=fs.readFileSync('visualizer/index.html','utf8'),m=h.match(/<script>([\s\S]*?)<\/script>/);new Function(m[1]);console.log('visualizer JS syntax OK')"
     ```
  3. **HTTP & Live/Demo Smoke Check**:
     - Run `node tools/serve-visualizer.mjs`, verify `GET http://127.0.0.1:4177/state.json`, `/chat.json`, `/usage.json` return HTTP `200` with valid JSON, and verify **Demo mode** transitions cleanly through all phases, gates, error bubbles, and prop handoffs in English.

---

## 7. Git, CI & Docmost Status

- **Base Branch**: `main` (`remotes/origin/main`; active feature branch: `feat/update-visualizer`).
- **CI / Repo PR Template**: `Not found` in `.github/`; PR descriptions follow `.agents/skills/pr-description-generator/SKILL.md` and Git policies follow `.agents/skills/git-workflow/SKILL.md`.
- **Docmost Service Tech Doc Page ID**: `None` registered for `ai-engineering-office` in `office.config.yml` (documentation maintained locally in `README.md` and `.agents/reference/ai-engineering-office/SKILLS.md`).

---

## 8. Guardrails (DO NOT Violate)

1. **NEVER echo or commit credentials from `.mcp.json` or `git remote -v`**: Local git remote URL embeds a GitHub Personal Access Token (`<redacted>`); never paste raw `git remote -v` output or `.mcp.json` tokens into Markdown docs, plans, commits, or PR descriptions.
2. **NEVER introduce external npm runtime packages without approval**: `tools/*.mjs` and `visualizer/index.html` are intentionally zero-dependency so they run out-of-the-box on any machine with Node.js 18+.
3. **NEVER allow `tools/office-hook.mjs` to exit non-zero or write non-JSON noise to `stdout`**: Antigravity expects valid JSON (`{}`) on `stdout` for `PreInvocation`, `PostToolUse`, and `PostInvocation` hooks.
4. **NEVER remove recursion guards for internal state scripts**: `inferToolAction` and `PostToolUse` must continue ignoring `office-state.mjs`, `office-hook.mjs`, and `serve-visualizer.mjs` commands to avoid feedback loops.
5. **NEVER bypass HTML escaping in `renderRich`**: User prompts and agent transcripts may contain raw `<USER_REQUEST>`, `<script>`, or HTML snippets; always escape before applying the tag whitelist.
6. **NEVER run `office-state.mjs reset` or `dispose` automatically without user consent**: Clearing `.office/state.json`, `.office/chat.json`, or `.office/tasks/` requires explicit user confirmation.
7. **NEVER keep stale Gate banners active after user approval or `phase done`**: Transitioning past a gate or reaching `done` must always clear `s.gate = null`.
8. **ALWAYS keep Demo Mode (`DEMO` & `DEMO_CHAT`) synchronized with live state schema and agent IDs**: `visualizer/index.html` feeds `demoState` through the exact same `apply()` and `renderPanel()` pipeline as live `/state.json`.

---

## 9. Confirmed Architectural Decisions

1. **Reference Folder Path**: Confirmed and renamed to `.agents/reference/ai-engineering-office/SKILLS.md`.
2. **Centralized 4 AI Model Avatars**: `argon` (`Gemini 4 Argon`), `flash` (`Gemini 3.8 Flash`), `opus` (`Claude Opus 5.5`), and `sonnet` (`Claude Sonnet 5.5`) own all SDLC workflow phases.
3. **Plan Editing Action Bubble**: In-place edits (`edit_file` / `replace`) to `implementation_plan.md` display `Editing implementation_plan.md` without regressing the workflow phase to `plan`.
4. **Localization Scope**: Visualizer UI, canvas, status badges, activity logs, Demo Mode, and CLI tools are in 100% English; conversational interaction with the user remains in Indonesian.
5. **Task History**: Old task folders from Oct 25 disposed per user instruction.
