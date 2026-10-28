# Office Visualizer Synchronization (Mandatory)

This office runs a 2D web visualizer that reads `.office/state.json` and `.office/chat.json`. Synchronize state via the terminal from the workspace root (Node 18+). A state write failure must never halt engineering work. Complete workflow details are in `AGENTS.md`.

At the start of every user instruction:
`node tools/office-state.mjs say user "<concise prompt summary>"`

When advancing phases or agent status:
```bash
node tools/office-state.mjs task <id> "<title>" <project> <branch>
node tools/office-state.mjs phase <intake|profile|plan|gate1|branch|code|test|docs|gate2|release|done>
node tools/office-state.mjs agent <argon|flash|opus|sonnet> <idle|working|waiting|done|blocked> "<short message>"
node tools/office-state.mjs handoff <from> <to> "<label>"
node tools/office-state.mjs gate <1|2|3|none> "<question for user>"
```

Crucial Gate & Completion Rules:
- Immediately upon user approval/proceed at a Gate (`gate1`, `gate2`, `gate3`), you **must** clear the gate (`node tools/office-state.mjs gate none`) and transition `phase` to the next working phase so the awaiting decision banner disappears immediately.
- Once all requested work is finished and no actions are awaiting user approval, you **must** set `node tools/office-state.mjs gate none` and `node tools/office-state.mjs phase done`.
- The **Conversation** panel displays concise summaries of conversation turns (`user` & `assistant`).
- The **Activity** panel displays up to 100 recent reverse-chronological log entries.

At the end of every response to the user:
`node tools/office-state.mjs say assistant "<concise response summary>"`

When executing on behalf of an active AI model (`argon`, `flash`, `opus`, `sonnet`), set its status to `working` at the start and `done` (or `idle`) upon completion.

When starting a **new task/scan** (if `.office/state.json` or `.office/chat.json` contains history from a previous task) or when reaching **task completion (`phase done`)**, **prompt the user** whether previous task history should be cleared or disposed:
- Clear visualizer & chat only: `node tools/office-state.mjs reset`
- Full dispose (clear visualizer + chat + delete `.office/tasks/<task-id|all>`): `node tools/office-state.mjs dispose [all|<task-id>]`
Do not execute `reset` or `dispose` automatically without explicit user consent.
