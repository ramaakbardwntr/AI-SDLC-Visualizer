---
description: Resume a paused task or submit a gate decision (approve/revise/cancel)
argument-hint: <task-id> [decision, e.g. "approve option A"]
---

Resume task: **$ARGUMENTS**

1. Read `.office/state.json` and `.office/tasks/<task-id>/` (`brief.md`, `plan.md`, `test-report.md`, `docs-draft.md`, ...). Identify the latest completed phase.
2. If user provides a decision in arguments, apply it to the pending gate (`approve option X` = proceed; revision = return to plan; cancel = `phase done`). If no decision is provided and gate is waiting, re-prompt the gate question.
3. Verify repository state before proceeding: correct active branch, clean working tree, expected commits present.
4. Continue execution from the next SDLC phase.
