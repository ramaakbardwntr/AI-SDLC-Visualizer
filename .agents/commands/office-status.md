---
description: Display AI Engineering Office status, active task, and pending gates
---

Read `.office/state.json` and `.office/tasks/`. Report a concise summary: active task (title, project, branch), current phase, active AI model status (`argon`, `flash`, `opus`, `sonnet`), pending gate awaiting user decision (if any), and unfinished tasks. Remind the user that the 2D visualizer can be viewed at `node tools/serve-visualizer.mjs` (http://localhost:4177).
