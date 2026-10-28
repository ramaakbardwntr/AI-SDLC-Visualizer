#!/usr/bin/env node
// Writes .office/state.json read by visualizer. Zero dependencies (Node 18+).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  syncChatFileToDisk,
  getUserName,
  MODEL_AGENTS,
  MODEL_META,
  canonAgent,
  readJsonSafe,
  writeJsonSafe,
} from './mirror-transcript.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.office');
const file = path.join(dir, 'state.json');

const STATUS = ['idle', 'working', 'waiting', 'done', 'blocked'];
const PHASES = ['intake', 'profile', 'plan', 'gate1', 'branch', 'code', 'test', 'docs', 'gate2', 'release', 'done'];

const fresh = () => ({
  task: null,
  phase: 'intake',
  gate: null,
  activeAgent: 'flash',
  agents: Object.fromEntries(MODEL_AGENTS.map(a => [a, { status: 'idle', message: '' }])),
  handoffs: [],
  handoffSeq: 0,
  log: [],
  userName: getUserName(),
});

function load() {
  const raw = readJsonSafe(file, {});
  const base = fresh();
  const loadedAgents = { ...base.agents };
  if (raw.agents) {
    for (const [k, v] of Object.entries(raw.agents)) {
      const c = canonAgent(k);
      if (loadedAgents[c]) loadedAgents[c] = v;
    }
  }
  return { ...base, ...raw, agents: loadedAgents };
}

function save(s) {
  s.updatedAt = new Date().toISOString();
  writeJsonSafe(file, s);
}

const pushLog = (s, text) => {
  s.log.push({ at: new Date().toISOString(), text });
  s.log = s.log.slice(-100);
};

function fail(msg) { console.error('office-state: ' + msg); process.exit(1); }

const [cmd, ...a] = process.argv.slice(2);
const s = load();
const userName = getUserName();

switch (cmd) {
  case 'reset': {
    const clearedAt = new Date().toISOString();
    Object.assign(s, fresh(), { clearedAt });
    try { fs.rmSync(path.join(dir, 'chat.json'), { force: true }); } catch {}
    break;
  }
  case 'dispose': {
    const [target] = a;
    const taskId = target || s.task?.id;
    const tasksDir = path.join(dir, 'tasks');
    if (target === 'all') {
      try { fs.rmSync(tasksDir, { recursive: true, force: true }); } catch {}
    } else if (taskId) {
      try { fs.rmSync(path.join(tasksDir, taskId), { recursive: true, force: true }); } catch {}
    }
    const clearedAt = new Date().toISOString();
    Object.assign(s, fresh(), { clearedAt });
    try { fs.rmSync(path.join(dir, 'chat.json'), { force: true }); } catch {}
    break;
  }
  case 'task': {
    const [id, title, project = '-', branch = '-'] = a;
    if (!id) fail('usage: task <id> "<title>" <project> <branch>');
    s.task = { id, title: title || id, project, branch };
    pushLog(s, `Task started: ${title || id}`);
    break;
  }
  case 'phase': {
    const [p] = a;
    if (!PHASES.includes(p)) fail(`phase must be one of: ${PHASES.join(', ')}`);
    s.phase = p;
    if (!p.startsWith('gate')) {
      s.gate = null;
      for (const ag of MODEL_AGENTS) {
        if (s.agents[ag]?.status === 'waiting') {
          s.agents[ag] = { status: p === 'done' ? 'done' : 'idle', message: p === 'done' ? 'Done' : '' };
        }
      }
    }
    if (p === 'done') {
      s.gate = null;
      for (const ag of MODEL_AGENTS) {
        if (s.agents[ag]?.status === 'working' || s.agents[ag]?.status === 'waiting') {
          s.agents[ag] = { status: 'done', message: s.agents[ag].message || 'Done' };
        }
      }
    }
    pushLog(s, `Phase: ${p}`);
    break;
  }
  case 'agent': {
    const [id, status, ...msg] = a;
    if (!STATUS.includes(status)) fail(`status must be one of: ${STATUS.join(', ')}`);
    const canonicalId = canonAgent(id, s.activeAgent || 'flash');
    s.agents[canonicalId] = { status, message: msg.join(' ').slice(0, 80) };
    s.activeAgent = canonicalId;
    if (status === 'working' && s.gate) {
      s.gate = null;
      if (s.phase === 'gate1') s.phase = 'code';
      else if (s.phase === 'gate2') s.phase = 'docs';
    }
    const agentLabel = MODEL_META[canonicalId]?.name || canonicalId;
    if (msg.length) pushLog(s, `${agentLabel}: ${msg.join(' ')}`);
    break;
  }
  case 'handoff': {
    const [from, to, ...label] = a;
    const canFrom = ['you', 'docmost', 'github', 'jira'].includes(from) ? from : canonAgent(from, s.activeAgent || 'flash');
    const canTo = ['you', 'docmost', 'github', 'jira'].includes(to) ? to : canonAgent(to, s.activeAgent || 'flash');
    s.handoffSeq += 1;
    const l = (label.join(' ') || 'task').slice(0, 24);
    s.handoffs.push({ n: s.handoffSeq, from: canFrom, to: canTo, label: l, at: new Date().toISOString() });
    s.handoffs = s.handoffs.slice(-20);
    break;
  }
  case 'gate': {
    const [g, ...q] = a;
    if (g === 'none' || g === undefined) {
      s.gate = null;
      for (const ag of MODEL_AGENTS) {
        if (s.agents[ag]?.status === 'waiting') {
          s.agents[ag] = { status: s.phase === 'done' ? 'done' : 'idle', message: s.phase === 'done' ? 'Done' : '' };
        }
      }
    } else if (['1', '2', '3'].includes(g)) {
      s.gate = { n: Number(g), question: q.join(' ') || `Awaiting ${userName}'s decision` };
      pushLog(s, `Gate ${g}: awaiting ${userName}'s decision`);
    } else fail('gate must be 1, 2, 3, or none');
    break;
  }
  case 'log': {
    pushLog(s, a.join(' '));
    break;
  }
  case 'say': {
    const [role, text, who] = a;
    if (!['user', 'assistant'].includes(role) || !text) fail('usage: say <user|assistant> "<text>" [agent]');
    if (role === 'user' && s.gate) {
      s.gate = null;
    }
    const cf = path.join(dir, 'chat.json');
    let c; try { c = JSON.parse(fs.readFileSync(cf, 'utf8')); } catch { c = { seq: 0, messages: [] }; }
    c.seq = (c.seq || 0) + 1;
    const rawText = String(text || '').replace(/\r\n/g, '\n').trim();
    const agentName = who ? (canonAgent(who, s.activeAgent || 'flash')) : undefined;
    c.messages = [
      ...(c.messages || []).filter(m => m.role === 'user' || m.role === 'assistant'),
      {
        n: c.seq,
        at: new Date().toISOString(),
        role,
        ...(agentName ? { agent: agentName } : {}),
        text: rawText,
        md: rawText
      }
    ];
    writeJsonSafe(cf, c);
    break;
  }
  default:
    fail('command: reset | dispose | task | phase | agent | handoff | gate | log | say');
}

save(s);
if (cmd === 'say') {
  syncChatFileToDisk();
}
