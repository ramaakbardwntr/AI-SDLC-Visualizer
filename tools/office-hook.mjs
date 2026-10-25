#!/usr/bin/env node
// Hook Claude Code / Antigravity -> visualizer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  syncChatFileToDisk,
  syncStateFromTranscript,
  summarizeForChat,
  inferRoleFromPrompt,
  inferToolAction,
  extractProjectFromPath,
  getUserName,
  getConversationTitle,
} from './mirror-transcript.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.office');
const stateFile = path.join(dir, 'state.json');
const chatFile = path.join(dir, 'chat.json');
const AGENTS = ['manager', 'scout', 'architect', 'developer', 'qa', 'scribe', 'release'];

const freshState = () => ({
  task: null, phase: 'intake', gate: null,
  agents: Object.fromEntries(AGENTS.map(a => [a, { status: 'idle', message: '' }])),
  handoffs: [], handoffSeq: 0, log: [],
});
function readJson(f, fallback) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } }
function writeJson(f, o) {
  fs.mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(o, null, 2);
  const tmp = f + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, f);
  } catch {
    fs.writeFileSync(f, json);
    try { fs.unlinkSync(tmp); } catch {}
  }
}
const clip = (t, n) => { t = String(t ?? '').replace(/\s+$/g, ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const base = p => String(p || '').split(/[\\/]/).pop();

function pushChat(entry) {
  if (entry.role !== 'user' && entry.role !== 'assistant') return;
  const text = summarizeForChat(entry.text, entry.role);
  if (!text) return;
  const c = readJson(chatFile, { seq: 0, messages: [] });
  const prev = (c.messages || []).filter(m => m.role === entry.role).pop();
  if (prev && prev.text === text) return;
  c.seq = (c.seq || 0) + 1;
  c.messages = [...(c.messages || []).filter(m => m.role === 'user' || m.role === 'assistant'), { n: c.seq, at: new Date().toISOString(), ...entry, text }].slice(-100);
  writeJson(chatFile, c);
}
function mutateState(fn) {
  const s = { ...freshState(), ...readJson(stateFile, {}) };
  s.agents = { ...freshState().agents, ...(s.agents || {}) };
  fn(s);
  s.updatedAt = new Date().toISOString();
  writeJson(stateFile, s);
}
const log = (s, text) => { s.log = [...(s.log || []), { at: new Date().toISOString(), text }].slice(-100); };
const handoff = (s, from, to, label) => {
  if (!from || !to || from === to) return;
  const cleanLabel = String(label || '').slice(0, 24);
  const prev = s.handoffs && s.handoffs[s.handoffs.length - 1];
  if (prev && prev.from === from && prev.to === to && prev.label === cleanLabel) return;
  s.handoffSeq = (s.handoffSeq || 0) + 1;
  s.handoffs = [...(s.handoffs || []), { n: s.handoffSeq, from, to, label: cleanLabel, at: new Date().toISOString() }].slice(-20);
};

function summarizeTool(name, input = {}) {
  switch (name) {
    case 'Read': case 'Write': case 'Edit': case 'MultiEdit': case 'NotebookEdit':
      return `${name} ${base(input.file_path || input.notebook_path)}`;
    case 'Bash': return 'Bash ' + clip(input.command, 70);
    case 'Grep': return 'Grep ' + clip(input.pattern, 40);
    case 'Glob': return 'Glob ' + clip(input.pattern, 40);
    case 'Task': case 'Agent': return `${input.subagent_type || 'agent'}: ${clip(input.description, 40)}`;
    case 'WebFetch': case 'WebSearch': return `${name} ${clip(input.url || input.query, 50)}`;
    default: return name || 'tool';
  }
}

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
const finish = () => {
  if (source === 'antigravity') {
    syncChatFileToDisk();
    process.stdout.write('{}');
  }
  process.exit(0);
};

// ---- Antigravity ----
function collectText(o, out = []) {
  if (!o || typeof o !== 'object') return out;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && /^(text|content|response|message|userResponse|modifiedResponse|prompt|query)$/i.test(k)) out.push(v);
    else if (v && typeof v === 'object') collectText(v, out);
  }
  return out;
}
function cleanUserPrompt(s) {
  if (!s) return '';
  const m = String(s).match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/i);
  if (m) return m[1].trim();
  return String(s)
    .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/gi, '')
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
    .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, '')
    .trim();
}
function antigravityTranscript(file, clearedAt) {
  const r = { user: '', assistant: '' };
  const minTime = clearedAt ? Date.parse(clearedAt) : 0;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (minTime && e.created_at && Date.parse(e.created_at) <= minTime) continue;
      const tag = JSON.stringify(e).slice(0, 400);
      const best = () => collectText(e).sort((a, b) => b.length - a.length)[0] || '';
      if (e.type === 'USER_INPUT' || /USER_INPUT/i.test(tag)) {
        const u = cleanUserPrompt(typeof e.content === 'string' ? e.content : best());
        if (u) r.user = u;
      } else if (e.type === 'PLANNER_RESPONSE' || /PLANNER_RESPONSE/i.test(tag)) {
        const a = typeof e.content === 'string' ? e.content.trim() : '';
        if (a) r.assistant = a;
      }
    }
  } catch {}
  return r;
}
function summarizeAg(call = {}) {
  const name = call.name || 'tool', a = call.args || {};
  if (a.toolSummary && a.CommandLine) return `⚡ ${a.toolSummary}`;
  if (a.CommandLine) return `⚡ ${name} ${clip(a.CommandLine, 50)}`;
  if (name === 'invoke_subagent') return `🤖 invoke_subagent [${a.Role || a.TypeName || 'subagent'}]`;
  if (name === 'send_message') return `💬 send_message → ${a.Recipient}`;
  const k = ['AbsolutePath', 'TargetFile', 'File', 'FilePath', 'Path', 'Url', 'Query', 'Pattern', 'query'].find(x => typeof a[x] === 'string');
  if (k) return `🛠️ ${name} ${k === 'Query' || k === 'query' || k === 'Pattern' || k === 'Url' ? clip(a[k], 40) : base(a[k])}`;
  return `🛠️ ${name}`;
}
function fromAntigravity(inp, ev) {
  if (ev === 'PostToolUse') return { hook_event_name: 'PostToolUse', tool_name: inp.toolCall?.name || '__ag__', toolCall: inp.toolCall, _summary: summarizeAg(inp.toolCall), _args: JSON.stringify(inp.toolCall?.args || {}), error: inp.error, conversationId: inp.conversationId };
  const clearedAt = readJson(stateFile, {}).clearedAt;
  const t = inp.transcriptPath ? antigravityTranscript(inp.transcriptPath, clearedAt) : { user: '', assistant: '' };
  const userPrompt = cleanUserPrompt(inp.lastUserInput) || t.user;
  if (ev === 'PreInvocation') return { hook_event_name: 'AgPrompt', prompt: userPrompt, prev_assistant: t.assistant, n: inp.invocationNum, workspacePaths: inp.workspacePaths, conversationId: inp.conversationId };
  if (ev === 'PostInvocation' || ev === 'Stop') return { hook_event_name: 'Stop', last_assistant_message: t.assistant, conversationId: inp.conversationId };
  return { hook_event_name: ev, conversationId: inp.conversationId };
}

async function readStdin() {
  let d = ''; for await (const c of process.stdin) d += c; return d;
}

function handlePromptEvent(rawPrompt, workspacePaths, convId) {
  const text = summarizeForChat(rawPrompt, 'user');
  if (!text) return;
  pushChat({ role: 'user', text });
  const userName = getUserName();
  const defaultProject = path.basename(root) || 'ai-engineering-office';
  const convTitle = getConversationTitle(convId);

  mutateState(s => {
    let wsName = Array.isArray(workspacePaths) && workspacePaths[0] ? extractProjectFromPath(workspacePaths[0]) : null;
    if (!wsName || wsName === 'workspace' || wsName === 'logs') wsName = defaultProject;

    if (!s.task || s.task.project === 'workspace' || s.task.project === 'logs') {
      s.task = {
        id: convId ? convId.slice(0, 8) : (s.task?.id || 'live'),
        title: convTitle || s.task?.title || 'Percakapan Antigravity',
        project: wsName || (s.task?.project && s.task.project !== 'workspace' && s.task.project !== 'logs' ? s.task.project : defaultProject),
        branch: s.task?.branch || '-',
        mode: 'A',
      };
    } else if (convTitle && s.task.title !== convTitle) {
      s.task.title = convTitle;
    }
    const isReject = (s.phase === 'gate1' || s.gate?.n === 1 || /\b(tolak|revisi|reject)\b/i.test(rawPrompt)) &&
      !/^\s*(ya|yes|ok|oke|setuju|approve|proceed|lanjut|gas|1\.\s*iya)\b/i.test(rawPrompt) &&
      /\b(tolak|revisi|reject|kurang|belum|jangan|ubah\s+plan)\b/i.test(rawPrompt);

    if (isReject) {
      s.gate = null;
      s.phase = 'plan';
      s.agents.architect = { status: 'working', message: `Diskusi revisi plan dengan ${userName}` };
      handoff(s, 'you', 'architect', 'Tolak plan: revisi');
      log(s, `${userName} menolak/revisi plan: ` + clip(text, 70));
      return;
    }

    const wasGate = s.gate?.n;
    s.gate = null;
    const inferred = wasGate === 1
      ? { role: 'developer', phase: 'code' }
      : wasGate === 2
        ? { role: 'scribe', phase: 'docs' }
        : inferRoleFromPrompt(rawPrompt);

    // ALUR WAJIB: Selalu ke Architect terlebih dahulu!
    handoff(s, 'you', 'architect', wasGate ? 'approve' : 'prompt');
    log(s, `${userName}: ` + clip(text, 80));

    if (inferred.role !== 'architect') {
      handoff(s, 'architect', inferred.role, 'task');
      s.phase = inferred.phase;
      ['architect', 'developer', 'qa', 'scribe'].forEach(r => {
        if (r !== inferred.role) s.agents[r] = { status: 'idle', message: '' };
      });
      s.agents[inferred.role] = { status: 'working', message: 'Menerima delegasi: ' + clip(text, 44) };
    } else {
      s.phase = inferred.phase;
      ['architect', 'developer', 'qa', 'scribe'].forEach(r => {
        if (r !== 'architect') s.agents[r] = { status: 'idle', message: '' };
      });
      s.agents.architect = { status: 'working', message: 'Menerima prompt: ' + clip(text, 44) };
    }
  });
}

try {
  let input = JSON.parse((await readStdin()) || '{}');
  if (source === 'antigravity') input = fromAntigravity(input, arg('event'));
  const ev = input.hook_event_name;
  const agentOf = i => (AGENTS.includes(i.agent_type) ? i.agent_type : null);
  const userName = getUserName();

  if (ev === 'UserPromptSubmit') {
    handlePromptEvent(input.prompt, input.workspacePaths, input.conversationId);
  } else if (ev === 'AgPrompt') {
    const msgs = readJson(chatFile, { messages: [] }).messages;
    const prevAsst = summarizeForChat(input.prev_assistant, 'assistant');
    const lastAsst = msgs.filter(m => m.role === 'assistant').pop();
    if (prevAsst && (!lastAsst || lastAsst.text !== prevAsst)) {
      pushChat({ role: 'assistant', text: prevAsst });
    }
    const last = msgs.filter(m => m.role === 'user').pop();
    const text = summarizeForChat(input.prompt, 'user');
    if (text && (!last || last.text !== text)) {
      handlePromptEvent(input.prompt, input.workspacePaths, input.conversationId);
    } else {
      mutateState(s => {
        const active = ['architect', 'developer', 'qa', 'scribe'].find(r => s.agents[r]?.status === 'working') || inferRoleFromPrompt(input.prompt).role;
        if (s.phase === 'done') s.phase = inferRoleFromPrompt(input.prompt).phase;
        s.agents[active] = { status: 'working', message: s.agents[active]?.message || 'Memproses instruksi' };
      });
    }
  } else if (ev === 'PostToolUse') {
    const cmd = input.tool_input?.command || input._args || '';
    if (/office-state\.mjs|office-hook\.mjs/.test(cmd)) finish();
    const tc = input.toolCall || { name: input.tool_name, args: input.tool_input || {} };
    const act = inferToolAction(tc, String(input.error || ''));
    const who = agentOf(input) || act?.role || 'architect';
    const sum = act?.message || input._summary || summarizeTool(input.tool_name, input.tool_input);
    mutateState(s => {
      const prevActive = ['architect', 'developer', 'qa', 'scribe'].find(r => s.agents[r]?.status === 'working');
      if (prevActive && prevActive !== who) {
        s.agents[prevActive] = { status: 'idle', message: '' };
        handoff(s, prevActive, who, act?.phase || 'tugas');
      }
      if (act?.phase) s.phase = act.phase;
      if (act?.gate !== undefined) s.gate = act.gate;
      else if (s.gate) s.gate = null;
      s.agents[who] = { status: act?.status || 'working', message: clip(sum, 60) };
      if (act?.propHandoff) handoff(s, act.propHandoff[0], act.propHandoff[1], act.propHandoff[2]);
    });
  } else if (ev === 'SubagentStart') {
    const who = agentOf(input) || 'architect';
    mutateState(s => {
      s.gate = null;
      s.agents[who] = { status: 'working', message: 'Mulai bekerja' };
      handoff(s, 'you', who, 'tugas');
      log(s, `${who}: mulai bekerja`);
    });
  } else if (ev === 'SubagentStop') {
    const who = agentOf(input) || 'architect';
    const text = summarizeForChat(input.last_assistant_message || (input.agent_transcript_path && lastAssistantText(input.agent_transcript_path)), 'assistant');
    if (text) pushChat({ role: 'assistant', agent: who, text });
    mutateState(s => {
      s.agents[who] = { status: 'done', message: 'Selesai' };
      handoff(s, who, 'you', 'hasil');
      log(s, `${who}: selesai`);
    });
  } else if (ev === 'Notification') {
    mutateState(s => {
      const active = ['architect', 'developer', 'qa', 'scribe'].find(r => s.agents[r]?.status === 'working') || 'architect';
      s.agents[active] = { status: 'waiting', message: clip(input.message || `Butuh perhatian ${userName}`, 60) };
      log(s, `Menunggu ${userName}: ` + clip(input.message || '', 80));
    });
  } else if (ev === 'Stop') {
    syncStateFromTranscript();
    const text = summarizeForChat(input.last_assistant_message || lastAssistantText(input.transcript_path), 'assistant');
    const lastAsst = readJson(chatFile, { messages: [] }).messages.filter(m => m.role === 'assistant').pop();
    const isNew = Boolean(text && (!lastAsst || lastAsst.text !== text));
    if (isNew) pushChat({ role: 'assistant', text });
    mutateState(s => {
      const activeGate = Boolean(s.gate && s.phase !== 'done' && (s.phase === 'gate1' || s.phase === 'gate2' || s.phase === 'release'));
      if (!activeGate) s.gate = null;
      const active = ['architect', 'developer', 'qa', 'scribe'].find(r => s.agents[r]?.status === 'working') || 'architect';
      if (activeGate) {
        s.agents[active] = { status: 'waiting', message: `Menunggu keputusan ${userName}` };
      } else {
        s.phase = 'done';
        ['architect', 'developer', 'qa', 'scribe'].forEach(r => {
          if (s.agents[r]?.status === 'working') s.agents[r] = { status: 'done', message: 'Selesai' };
        });
      }
      if (isNew) handoff(s, active, 'you', activeGate ? 'review' : 'jawaban');
    });
  }
} catch { /* jangan pernah mengganggu Claude Code / Antigravity */ }
finish();
