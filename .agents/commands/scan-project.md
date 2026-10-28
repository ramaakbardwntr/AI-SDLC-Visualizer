---
description: Scan repository and generate or update project profile (.agents/reference/<project>/SKILLS.md)
argument-hint: <project-name or owner/repo>
---

Execute project scan workflow for: **$ARGUMENTS**

1. Check if `.office/state.json` contains history from a previous task; if so, ask the user whether to clear (`node tools/office-state.mjs reset` or `dispose`) or retain it. Set `node tools/office-state.mjs task scan-$ARGUMENTS "Scan project $ARGUMENTS" "$ARGUMENTS" "-" "-"` and `node tools/office-state.mjs phase profile`.
2. Locate the project in `office.config.yml`. If missing, ask once for the GitHub repository name (`owner/repo`) and base branch. If not cloned locally, clone into `workspace/` (will request permission).
3. Execute the scan using skill `project-scanner` on the active AI model agent (`argon` or `flash`). `node tools/office-state.mjs agent argon working "Scanning $ARGUMENTS"`.
4. Present findings summary and **Open Questions**. Request user confirmation on classification (microservice/monolith/legacy), TFM, and unit test DB strategy.
5. After user confirms or corrects findings, update profile status to `status: confirmed`, save to `.agents/reference/<project>/SKILLS.md`, and complete via `node tools/office-state.mjs phase done`.
