---
description: Start a new task
argument-hint: <brief task description, optional>
---

Initiate new task. Initial user input: **$ARGUMENTS**

Follow the SDLC workflow from Phase 1 (Intake):

1. Check if `.office/state.json` contains history from a previous task. If so, prompt the user whether to reset/dispose previous state or retain it. Generate `task-id` (`YYYYMMDD-slug`), then set `node tools/office-state.mjs task <id> "<title>" <project> <branch> <A|B>` and `node tools/office-state.mjs phase intake`.
2. Clarify any remaining unknowns: project name, **branch name** (always provided by user), issue/Jira key, unit test pattern example, and whether this is a new feature.
3. Verify branch presence (`git-workflow` skill) and inform the user.
4. Create `.office/tasks/<id>/brief.md` from `templates/task-brief.md`.
5. Proceed to Phase 2 (project profile check), Phase 3 (plan authoring on active AI model), and **halt at Gate 1**. No coding may begin before user approval.
