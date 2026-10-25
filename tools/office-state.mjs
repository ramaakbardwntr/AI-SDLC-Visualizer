#!/usr/bin/env node
// Menulis .office/state.json yang dibaca visualizer. Tanpa dependensi (Node 18+).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncChatFileToDisk, summarizeForChat, getUserName } from './mirror-transcript.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.office');
const file = path.join(dir, 'state.json');

const AGENTS = ['manager', 'scout', 'architect', 'developer', 'qa', 'scribe', 'release'];
const TARGETS = [...AGENTS, 'you', 'docmost', 'github', 'jira'];
const STATUS = ['idle', 'working', 'waiting', 'done', 'blocked'];
const PHASES = ['intake', 'profile', 'plan', 'gate1', 'branch', 'code', 'test', 'docs', 'gate2', 'release', 'done'];

const fresh = () => ({
  task: null,
  phase: 'intake',
  gate: null,
  agents: Object.fromEntries(AGENTS.map(a => [a, { status: 'idle', message: '' }])),
  handoffs: [],
  handoffSeq: 0,
  log: [],
  userName: getUserName(),
});

function writeJsonSafe(target, obj) {
  fs.mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(obj, null, 2);
  const tmp = target + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, target);
  } catch {
    fs.writeFileSync(target, json);
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function load() {
  try { return { ...fresh(), ...JSON.parse(fs.readFileSync(file, 'utf8')) }; }
  catch { return fresh(); }
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
  case 'dispose': {   // dispose [all|<task-id>]: bersihkan state.json + chat.json + hapus folder .office/tasks/<id|all>
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
    const [id, title, project = '-', branch = '-', mode = '-'] = a;
    if (!id) fail('usage: task <id> "<judul>" <project> <branch> <mode>');
    s.task = { id, title: title || id, project, branch, mode };
    pushLog(s, `Task dimulai: ${title || id}`);
    break;
  }
  case 'phase': {
    const [p] = a;
    if (!PHASES.includes(p)) fail(`phase harus salah satu: ${PHASES.join(', ')}`);
    s.phase = p;
    // Otomatis bersihkan gate apabila berpindah ke fase kerja non-gate atau done
    if (!p.startsWith('gate')) {
      s.gate = null;
      for (const ag of AGENTS) {
        if (s.agents[ag]?.status === 'waiting') {
          s.agents[ag] = { status: p === 'done' ? 'done' : 'idle', message: p === 'done' ? 'Selesai' : '' };
        }
      }
    }
    if (p === 'done') {
      s.gate = null;
      s.agents.manager = { status: 'done', message: 'Task selesai' };
      for (const ag of AGENTS) {
        if (s.agents[ag]?.status === 'working' || s.agents[ag]?.status === 'waiting') {
          s.agents[ag] = { status: 'done', message: s.agents[ag].message || 'Selesai' };
        }
      }
    }
    pushLog(s, `Fase: ${p}`);
    break;
  }
  case 'agent': {
    const [id, status, ...msg] = a;
    if (!AGENTS.includes(id)) fail(`agent harus salah satu: ${AGENTS.join(', ')}`);
    if (!STATUS.includes(status)) fail(`status harus salah satu: ${STATUS.join(', ')}`);
    s.agents[id] = { status, message: msg.join(' ').slice(0, 80) };
    // Bila ada agent mulai working setelah gate, otomatis bersihkan gate agar animasi "Menunggu keputusan" hilang
    if (status === 'working' && s.gate) {
      s.gate = null;
      if (s.phase === 'gate1') s.phase = 'code';
      else if (s.phase === 'gate2') s.phase = 'docs';
    }
    if (msg.length) pushLog(s, `${id}: ${msg.join(' ')}`);
    break;
  }
  case 'handoff': {
    const [from, to, ...label] = a;
    if (!TARGETS.includes(from) || !TARGETS.includes(to)) fail(`from/to harus salah satu: ${TARGETS.join(', ')}`);
    s.handoffSeq += 1;
    const l = (label.join(' ') || 'task').slice(0, 24);
    s.handoffs.push({ n: s.handoffSeq, from, to, label: l, at: new Date().toISOString() });
    s.handoffs = s.handoffs.slice(-20);
    break;
  }
  case 'gate': {
    const [g, ...q] = a;
    if (g === 'none' || g === undefined) {
      s.gate = null;
      if (s.agents.manager?.status === 'waiting') {
        s.agents.manager = { status: s.phase === 'done' ? 'done' : 'idle', message: s.phase === 'done' ? 'Task selesai' : '' };
      }
    } else if (['1', '2', '3'].includes(g)) {
      s.gate = { n: Number(g), question: q.join(' ') || `Menunggu keputusan ${userName}` };
      pushLog(s, `Gate ${g}: menunggu keputusan ${userName}`);
    } else fail('gate harus 1, 2, 3, atau none');
    break;
  }
  case 'log': {
    pushLog(s, a.join(' '));
    break;
  }
  case 'say': {   // pesan ringkas untuk panel Percakapan: say <user|assistant> "<teks>" [agent]
    const [role, text, who] = a;
    if (!['user', 'assistant'].includes(role) || !text) fail('usage: say <user|assistant> "<teks>" [agent]');
    if (role === 'user' && s.gate) {
      s.gate = null;
    }
    const cf = path.join(dir, 'chat.json');
    let c; try { c = JSON.parse(fs.readFileSync(cf, 'utf8')); } catch { c = { seq: 0, messages: [] }; }
    c.seq = (c.seq || 0) + 1;
    const summaryText = summarizeForChat(text, role);
    c.messages = [...(c.messages || []).filter(m => m.role === 'user' || m.role === 'assistant'), { n: c.seq, at: new Date().toISOString(), role, ...(who ? { agent: who } : {}), text: summaryText }].slice(-100);
    writeJsonSafe(cf, c);
    break;
  }
  default:
    fail('perintah: reset | dispose | task | phase | agent | handoff | gate | log | say');
}

save(s);
if (cmd !== 'reset' && cmd !== 'dispose') {
  syncChatFileToDisk();
}
