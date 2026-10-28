#!/usr/bin/env node
// Hook Claude Code / Antigravity -> visualizer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  syncChatFileToDisk,
  syncStateFromTranscript,
  summarizeForChat,
  inferPhaseFromPrompt,
  inferToolAction,
  extractProjectFromPath,
  getUserName,
  getConversationTitle,
  MODEL_AGENTS,
  MODEL_META,
  canonAgent,
  getLastSelectedModel,
  readJsonSafe,
  writeJsonSafe,
  cleanUserPrompt,
  clip,
} from './mirror-transcript.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.office');
const stateFile = path.join(dir, 'state.json');
const chatFile = path.join(dir, 'chat.json');
const freshState = () => ({
  task: null, phase: 'intake', gate: null,
  activeAgent: 'flash',
  agents: Object.fromEntries(MODEL_AGENTS.map(a => [a, { status: 'idle', message: '' }])),
  handoffs: [], handoffSeq: 0, log: [],
});

const readJson = readJsonSafe;
const writeJson = writeJsonSafe;
function pushChat(entry) {
  if (entry.role !== 'user' && entry.role !== 'assistant') return;
  const rawText = String(entry.text || '').replace(/\r\n/g, '\n').trim();
  if (!rawText) return;
  const c = readJson(chatFile, { seq: 0, messages: [] });
  const prev = (c.messages || []).filter(m => m.role === entry.role).pop();
  if (prev && (prev.text === rawText || prev.md === rawText)) return;
  c.seq = (c.seq || 0) + 1;
  c.messages = [
    ...(c.messages || []).filter(m => m.role === 'user' || m.role === 'assistant'),
    {
      n: c.seq,
      at: new Date().toISOString(),
      ...entry,
      text: rawText,
      md: entry.md || rawText
    }
  ];
  writeJson(chatFile, c);
}

function mutateState(fn) {
  const current = readJson(stateFile, {});
  const s = { ...freshState(), ...current };
  const loadedAgents = { ...freshState().agents };
  if (s.agents) {
    for (const [k, v] of Object.entries(s.agents)) {
      const c = canonAgent(k);
      if (loadedAgents[c]) loadedAgents[c] = v;
    }
  }
  s.agents = loadedAgents;
  fn(s);
  s.updatedAt = new Date().toISOString();
  writeJson(stateFile, s);
}

const log = (s, text) => {
  const prev = s.log && s.log[s.log.length - 1];
  if (prev && prev.text === text) return;
  s.log = [...(s.log || []), { at: new Date().toISOString(), text }].slice(-100);
};
const setAgentAct = (s, agentId, status, message, alsoLog = true) => {
  s.agents[agentId] = { status, message };
  if (alsoLog && message && message !== 'Done') {
    log(s, `${MODEL_META[agentId]?.name || agentId}: ${message}`);
  }
};
const handoff = (s, from, to, label) => {
  if (!from || !to || from === to) return;
  const cleanLabel = String(label || '').slice(0, 24);
  const canFrom = ['you', 'docmost', 'github', 'jira'].includes(from) ? from : canonAgent(from, s.activeAgent || 'flash');
  const canTo = ['you', 'docmost', 'github', 'jira'].includes(to) ? to : canonAgent(to, s.activeAgent || 'flash');
  const prev = s.handoffs && s.handoffs[s.handoffs.length - 1];
  if (prev && prev.from === canFrom && prev.to === canTo && prev.label === cleanLabel) return;
  s.handoffSeq = (s.handoffSeq || 0) + 1;
  s.handoffs = [...(s.handoffs || []), { n: s.handoffSeq, from: canFrom, to: canTo, label: cleanLabel, at: new Date().toISOString() }].slice(-20);
};

function lastAssistantText(file) {
  try {
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      let e; try { e = JSON.parse(lines[i]); } catch { continue; }
      if ((e.type === 'assistant' || e.message?.role === 'assistant') && Array.isArray(e.message?.content)) {
        const t = e.message.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
        if (t) return t;
      }
    }
  } catch {}
  return '';
}

const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const source = arg('source') || 'claude';

async function readStdin() {
  let d = ''; for await (const c of process.stdin) d += c; return d;
}

function handlePromptEvent(rawPrompt, workspacePaths, convId, modelHint = null) {
  const cleaned = cleanUserPrompt(rawPrompt);
  const summary = summarizeForChat(cleaned, 'user');
  if (!cleaned) return;
  pushChat({ role: 'user', text: cleaned });
  const userName = getUserName();
  const defaultProject = path.basename(root) || 'ai-engineering-office';
  const convTitle = getConversationTitle(convId);

  mutateState(s => {
    let wsName = Array.isArray(workspacePaths) && workspacePaths[0] ? extractProjectFromPath(workspacePaths[0]) : null;
    if (!wsName || wsName === 'workspace' || wsName === 'logs') wsName = defaultProject;

    const active = canonAgent(modelHint || s.activeAgent || getLastSelectedModel());
    s.activeAgent = active;

    if (!s.task || s.task.project === 'workspace' || s.task.project === 'logs') {
      s.task = {
        id: convId ? convId.slice(0, 8) : (s.task?.id || 'live'),
        title: convTitle || s.task?.title || 'Engineering Session',
        project: wsName || (s.task?.project && s.task.project !== 'workspace' && s.task.project !== 'logs' ? s.task.project : defaultProject),
        branch: s.task?.branch || '-',
      };
    } else if (convTitle && s.task.title !== convTitle) {
      s.task.title = convTitle;
    }

    const isReject = (s.phase === 'gate1' || s.gate?.n === 1 || /\b(tolak|revisi|reject|kurang|ubah\s+plan)\b/i.test(cleaned)) &&
      !/^\s*(ya|yes|ok|oke|setuju|approve|proceed|lanjut|gas|1\.\s*iya)\b/i.test(cleaned);

    MODEL_AGENTS.forEach(r => {
      if (r !== active) s.agents[r] = { status: 'idle', message: '' };
    });

    if (isReject) {
      s.gate = null;
      s.phase = 'plan';
      handoff(s, 'you', active, 'Revise plan');
      log(s, `${userName} requested plan revision: ` + clip(summary, 70));
      setAgentAct(s, active, 'working', `Discussing plan revision with ${userName}`, true);
      return;
    }

    const wasGate = s.gate?.n;
    s.gate = null;
    s.phase = wasGate === 1 ? 'code' : inferPhaseFromPrompt(cleaned);

    handoff(s, 'you', active, wasGate ? 'approve' : 'prompt');
    log(s, `${userName}: ` + clip(summary, 80));
    setAgentAct(s, active, 'working', 'Analyzing request...', true);
  });
}

try {
  const rawStdin = await readStdin();

  // For Antigravity, transcript.jsonl is the authoritative single source of truth;
  // delegating directly avoids PreInvocation/PostInvocation step race conditions.
  if (source === 'antigravity') {
    syncStateFromTranscript();
    syncChatFileToDisk();
    process.stdout.write('{}');
    process.exit(0);
  }

  const input = JSON.parse(rawStdin || '{}');
  const ev = input.hook_event_name;
  const userName = getUserName();
  const modelHint = input.model || process.env.ANTHROPIC_MODEL || null;

  if (ev === 'UserPromptSubmit') {
    handlePromptEvent(input.prompt, input.workspacePaths, input.conversationId, modelHint);
  } else if (ev === 'PostToolUse') {
    const cmd = input.tool_input?.command || input._args || '';
    if (!/office-state\.mjs|office-hook\.mjs/.test(cmd)) {
      const tc = input.toolCall || { name: input.tool_name, args: input.tool_input || {} };
      mutateState(s => {
        const active = canonAgent(modelHint || s.activeAgent || 'flash');
        s.activeAgent = active;
        const act = inferToolAction(tc, String(input.error || ''), active, s.phase);
        if (!act) return;
        if (act.phase) s.phase = act.phase;
        if (act.gate !== undefined) s.gate = act.gate;
        else if (s.gate) s.gate = null;
        setAgentAct(s, active, act.status || 'working', clip(act.message, 60), true);
        if (act.propHandoff) handoff(s, act.propHandoff[0], act.propHandoff[1], act.propHandoff[2]);
      });
    }
  } else if (ev === 'SubagentStart') {
    mutateState(s => {
      const subTarget = canonAgent(input.agent_type || input.model || s.activeAgent || 'flash');
      s.gate = null;
      handoff(s, 'you', subTarget, 'task');
      setAgentAct(s, subTarget, 'working', 'Started delegated task', true);
    });
  } else if (ev === 'SubagentStop') {
    mutateState(s => {
      const subTarget = canonAgent(input.agent_type || input.model || s.activeAgent || 'flash');
      const rawAsst = String(input.last_assistant_message || (input.agent_transcript_path && lastAssistantText(input.agent_transcript_path)) || '').trim();
      if (rawAsst) pushChat({ role: 'assistant', agent: subTarget, text: rawAsst });
      s.agents[subTarget] = { status: 'done', message: 'Done' };
      handoff(s, subTarget, 'you', 'result');
      log(s, `${MODEL_META[subTarget]?.name || subTarget}: completed`);
    });
  } else if (ev === 'Notification') {
    mutateState(s => {
      const active = canonAgent(s.activeAgent || 'flash');
      const msg = clip(input.message || `Requires attention from ${userName}`, 60);
      setAgentAct(s, active, 'waiting', msg, true);
    });
  } else if (ev === 'Stop') {
    const rawAsst = String(input.last_assistant_message || lastAssistantText(input.transcript_path) || '').trim();
    const lastAsst = readJson(chatFile, { messages: [] }).messages.filter(m => m.role === 'assistant').pop();
    const isNew = Boolean(rawAsst && (!lastAsst || lastAsst.text !== rawAsst));
    if (isNew) pushChat({ role: 'assistant', text: rawAsst });
    mutateState(s => {
      const active = canonAgent(s.activeAgent || 'flash');
      const activeGate = Boolean(s.gate && s.phase !== 'done');
      if (activeGate) {
        s.agents[active] = { status: 'waiting', message: `Awaiting ${userName}'s decision` };
      } else {
        s.phase = 'done';
        MODEL_AGENTS.forEach(r => {
          if (s.agents[r]?.status === 'working') s.agents[r] = { status: 'done', message: 'Done' };
        });
      }
      if (isNew) handoff(s, active, 'you', activeGate ? 'review' : 'response');
    });
  }
} catch { /* Fail silently to protect IDE process */ }
process.exit(0);
