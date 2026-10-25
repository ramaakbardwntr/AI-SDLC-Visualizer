import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.office');
const stateFile = path.join(dir, 'state.json');
const chatFile = path.join(dir, 'chat.json');
const configFile = path.join(dir, 'config.json');
const AGENTS = ['manager', 'scout', 'architect', 'developer', 'qa', 'scribe', 'release'];

const clip = (t, n) => { t = String(t ?? '').replace(/\s+$/g, ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const base = p => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';

function unquote(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

function writeJsonSafe(target, obj) {
  fs.mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(obj, null, 2);
  const tmp = target + '.' + process.pid + '.' + Math.random().toString(36).slice(2, 7) + '.tmp';
  try {
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, target);
  } catch {
    fs.writeFileSync(target, json);
    try { fs.unlinkSync(tmp); } catch {}
  }
}

export function getUserName() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (cfg.userName && typeof cfg.userName === 'string') return cfg.userName.trim();
  } catch {}
  return 'Rama';
}

export function setUserName(name) {
  const clean = String(name || '').trim() || 'Rama';
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch {}
  cfg.userName = clean;
  writeJsonSafe(configFile, cfg);
  return clean;
}

export function cleanUserPrompt(s) {
  if (!s) return '';
  const m = String(s).match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/i);
  if (m) return m[1].trim();
  return String(s)
    .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/gi, '')
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
    .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, '')
    .trim();
}

/**
 * Membaca Judul Percakapan resmi Antigravity.
 * Prioritas:
 * 1. ~/.gemini/antigravity/annotations/<convId>.pbtxt (title:"...")
 * 2. Artifact plan/task di brain/<convId> (heading # ...)
 */
export function getConversationTitle(convId) {
  if (!convId) return null;
  const home = os.homedir();
  const candidatePaths = [
    path.join(home, '.gemini', 'antigravity', 'annotations', `${convId}.pbtxt`),
    path.join(home, '.gemini', 'antigravity-ide', 'annotations', `${convId}.pbtxt`),
    path.join(home, '.gemini', 'antigravity-cli', 'annotations', `${convId}.pbtxt`),
  ];
  for (const cp of candidatePaths) {
    try {
      if (fs.existsSync(cp)) {
        const content = fs.readFileSync(cp, 'utf8');
        const m = content.match(/title:\s*"((?:[^"\\]|\\.)*)"/);
        if (m && m[1]) {
          try {
            return JSON.parse(`"${m[1]}"`);
          } catch {
            return m[1].replace(/\\"/g, '"');
          }
        }
      }
    } catch {}
  }

  // Fallback: cek artifact implementation_plan.md atau task.md di brain/<convId>
  const brainDir = path.join(home, '.gemini', 'antigravity', 'brain', convId);
  for (const art of ['implementation_plan.md', 'task.md', 'walkthrough.md']) {
    try {
      const artPath = path.join(brainDir, art);
      if (fs.existsSync(artPath)) {
        const lines = fs.readFileSync(artPath, 'utf8').split('\n');
        for (const l of lines.slice(0, 10)) {
          const hm = l.match(/^#\s+(?:Implementation Plan:\s*|Task:\s*)?(.+)/i);
          if (hm && hm[1]) {
            return hm[1].trim();
          }
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Ekstraksi nama project yang akurat.
 * Menghindari 'workspace', mendeteksi subfolder workspace/<repo>,
 * mendeteksi nama repo/folder project lokal (mis. ai-engineering-office).
 */
export function extractProjectFromPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  const raw = unquote(filePath);
  const normalized = String(raw).replace(/\\+/g, '/').replace(/\/+/g, '/');
  if (/\.gemini[\\/]antigravity/i.test(raw) || /\.gemini\/antigravity/i.test(normalized)) return null;

  // 1. Cek bila berada di bawah folder workspace/<repo>
  const mWs = normalized.match(/\/workspace\/([^/]+)/i);
  if (mWs && mWs[1] && mWs[1] !== 'workspace') {
    return mWs[1];
  }

  // 2. Cek bila cocok dengan daftar project di office.config.yml
  try {
    const cfgContent = fs.readFileSync(path.join(root, 'office.config.yml'), 'utf8');
    const knownProjects = [...cfgContent.matchAll(/name:\s*([A-Za-z0-9._-]+)/g)].map(m => m[1]);
    for (const kp of knownProjects) {
      if (normalized.toLowerCase().includes(kp.toLowerCase())) return kp;
    }
  } catch {}

  // 3. Cek struktur path folder project
  const parts = normalized.split('/').filter(Boolean);
  const skip = new Set(['src', 'prisma', 'visualizer', 'tools', 'controllers', 'routes', 'helpers', 'dashboard', 'delivery', 'finance', 'sales', 'operation', 'auth', 'alerter', 'errors', 'health', '.agents', '.claude', '.office', 'node_modules', 'workspace', 'dist', 'build', 'bin', 'obj', 'logs', '.system_generated', 'brain', 'annotations', 'Users', 'AppData', 'Local', 'Roaming', 'Temp', 'tmp']);
  
  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i];
    if (!skip.has(part) && !/^[A-Za-z]:$/i.test(part) && !/^(Project|Projects|Work|Repo|Repos|Local)$/i.test(part)) {
      return part;
    }
  }
  return null;
}

export function extractProjectFromMetadata(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(?:Active Document|Other open documents:\s*-)\s*([A-Za-z]:\\[^\r\n(]+|\/[^\r\n(]+)/i);
  if (m) {
    const p = extractProjectFromPath(m[1].trim());
    if (p) return p;
  }
  // Cek apakah prompt menyebut nama repo/proyek spesifik
  try {
    const cfgContent = fs.readFileSync(path.join(root, 'office.config.yml'), 'utf8');
    const knownProjects = [...cfgContent.matchAll(/name:\s*([A-Za-z0-9._-]+)/g)].map(m => m[1]);
    for (const kp of knownProjects) {
      if (new RegExp(`\\b${kp}\\b`, 'i').test(raw)) return kp;
    }
  } catch {}
  return null;
}

/**
 * Meringkas pesan panjang untuk panel Percakapan.
 */
export function summarizeForChat(raw, role = 'assistant') {
  if (!raw) return '';
  let s = String(raw)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1');

  const lines = s
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => {
      if (!l) return false;
      if (l.startsWith('|') || /^[-=*_]{3,}$/.test(l) || /^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(l)) return false;
      return true;
    })
    .map(l => l.replace(/^#{1,6}\s+/, '').replace(/^>\s*/, '').trim())
    .filter(Boolean);

  if (lines.length === 0) return clip(String(raw).replace(/\s+/g, ' ').trim(), 200);

  const maxLines = 3;
  const maxChars = role === 'user' ? 220 : 260;
  const picked = lines.slice(0, maxLines).join(' • ');
  return clip(picked, maxChars);
}

/**
 * Teks mentah (markdown/HTML apa adanya) untuk dirender rich-text di panel Percakapan.
 * Dibatasi 1500 karakter agar chat.json tetap ringan.
 */
export function rawForChat(raw, max = 1500) {
  const t = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  // Potong pada akhir baris terdekat agar sintaks (mis. tabel) tidak terpotong di tengah
  const cut = t.slice(0, max);
  const nl = cut.lastIndexOf('\n');
  return (nl > max * 0.6 ? cut.slice(0, nl) : cut).replace(/\s+$/, '') + '\n…';
}

export function inferRoleFromPrompt(promptText) {
  const t = String(promptText || '');
  const wantsDocmost = /docmost|strand|tech\s*doc|\btd\b|\brfc\b|doc\s+scribing|scribe/i.test(t);
  const wantsTest = /unit\s*test|test\s*case|\bsdet\b|xunit|jest|vitest/i.test(t) && !/visualizer/i.test(t);
  const wantsPlan = /scan\s+project|implementation\s+plan|arsitektur|pros.*cons|assess|plan/i.test(t);
  const wantsCode = /\b(code|kode|endpoint|fix|bug|refactor|implement|posisi)\b/i.test(t);

  // Jika eksplisit minta dok Strand / Docmost / RFC / Tech Doc, utamakan Scribe
  if (wantsDocmost) return { role: 'scribe', phase: 'docs' };
  if (wantsTest) return { role: 'qa', phase: 'test' };
  if (wantsPlan) return { role: 'architect', phase: 'plan' };
  if (wantsCode || /jira|pull\s*request|\bpr\b|branch|commit|push/i.test(t)) return { role: 'developer', phase: 'code' };
  return { role: 'architect', phase: 'intake' };
}

const IGNORE_TOOLS = /^(manage_task|schedule|ask_question|send_message|manage_subagents)$/i;

export function inferToolAction(tc, genericContent = '', currentRole = 'architect') {
  const name = tc.name || '';
  if (IGNORE_TOOLS.test(name)) return null;

  const a = tc.args || {};
  const cmd = String(unquote(a.CommandLine || a.command) || '');
  const filePath = String(unquote(a.Path || a.TargetFile || a.FilePath || a.AbsolutePath || a.file_path || a.Pattern || a.Query || a.query) || '');
  const fbase = base(filePath);
  const summary = String(unquote(a.toolSummary) || '');
  const isRead = /^(read_file|view_file|grep_search|find_by_name|list_dir|Grep|Glob|Read)$/i.test(name);
  const isWrite = !isRead && /write|edit|replace|create|notebook/i.test(name);
  const cmdWrites = name === 'run_command' && /WriteAllText|Set-Content|Out-File|Add-Content|>\s*\S+\.\w+/i.test(cmd);

  if (name === 'run_command' && /office-state\.mjs|office-hook\.mjs|serve-visualizer\.mjs|Get-CimInstance|Get-Process|Stop-Process/i.test(cmd)) return null;

  // 1. Doc Scribing: PURE HANYA UNTUK STRAND DOCMOST MCP / EXTERNAL PARTY
  const isDocmostTool = /strand|docmost/i.test(name) || /^(search_pages|list_pages|get_page|create_page|update_page|create_page_from_template|list_templates|get_template|delete_page|move_page)$/i.test(name);
  if (isDocmostTool) {
    const tool = name.replace(/^mcp_[^_]+_/, '');
    const isWritingDocmost = /create|update|write|edit|append|publish|move/i.test(tool);
    return {
      role: 'scribe',
      phase: 'docs',
      message: isWritingDocmost ? `Push doc: ${clip(tool, 30)}` : `Docmost: ${clip(tool, 30)}`,
      propHandoff: isWritingDocmost ? ['scribe', 'docmost', 'Push Doc'] : null
    };
  }
  // Draft dokumen khusus Docmost sebelum dipush (mis. .office/tasks/<id>/docs-draft.md)
  if (/docs-draft\.md$/i.test(filePath)) {
    return {
      role: 'scribe',
      phase: 'docs',
      message: isWrite ? `Draft doc: ${fbase}` : `Membaca draft doc: ${fbase}`,
      propHandoff: null
    };
  }

  // 2. SDET: menjalankan unit test & file test
  if (name === 'run_command' && /\b(dotnet\s+test|npm\s+(run\s+)?test|npx\s+(jest|vitest|mocha)|yarn\s+test|pnpm\s+test|pytest)\b/i.test(cmd)) {
    const failed = /Command exited with code [^0]|FAIL\s|Failed!|Test Run Failed/i.test(genericContent);
    let errMsg = '';
    if (failed) {
      const names = [...genericContent.matchAll(/(?:Failed|FAIL|\u2715|\u00d7)\s+([A-Za-z0-9_.:-]+)/g)].map(m => m[1]);
      errMsg = names.length ? [...new Set(names)].slice(0, 4).join('; ') : 'Unit test gagal (non-green flow)';
    }
    return {
      role: 'qa', phase: 'test', status: failed ? 'blocked' : 'working',
      message: failed ? errMsg : `Menjalankan test: ${clip(summary || cmd, 40)}`,
      propHandoff: failed ? ['qa', 'developer', 'test error'] : null,
    };
  }
  if (/Tests?\.(cs|js|ts|jsx|tsx)$/i.test(filePath)) {
    return {
      role: 'qa',
      phase: 'test',
      message: isWrite ? `Tulis test: ${fbase}` : `Periksa test: ${fbase}`
    };
  }

  // 3. Engineer: Git Commit, Push, Branch, PR, & Jira
  if (name === 'run_command' && /\bgit\s+commit\b/i.test(cmd)) {
    return { role: 'developer', phase: 'code', message: `Commit ke Git: ${clip(cmd, 36)}`, propHandoff: ['developer', 'github', 'Commit'] };
  }
  if (name === 'run_command' && /\bgit\s+(checkout\s+-b|switch\s+-c)\b/i.test(cmd)) {
    return { role: 'developer', phase: 'branch', message: `Buat branch: ${clip(cmd, 36)}`, propHandoff: ['developer', 'github', 'Branch'] };
  }
  if (name === 'run_command' && /\bgit\s+push\b/i.test(cmd)) {
    return { role: 'developer', phase: 'release', message: 'Push branch ke GitHub', propHandoff: ['developer', 'github', 'Push Branch'] };
  }
  if ((name === 'run_command' && /\bgh\s+pr\b/i.test(cmd)) || /create_pull_request/i.test(name)) {
    return { role: 'developer', phase: 'release', message: 'Create Pull Request di GitHub', propHandoff: ['developer', 'github', 'Create PR'] };
  }
  if (/pr\.html|pull_request_template/i.test(filePath)) {
    return { role: 'developer', phase: 'release', message: isRead ? 'Membaca PR Template' : 'Menyiapkan PR Template', propHandoff: isRead ? null : ['developer', 'github', 'Draft PR'] };
  }
  if (/jira/i.test(name) || /jira\.md$/i.test(filePath)) {
    return { role: 'developer', phase: 'release', message: isRead ? 'Membaca Task Jira' : 'Menyiapkan Task Jira', propHandoff: isRead ? null : ['developer', 'jira', 'Write Jira'] };
  }

  // 4. Architect: SEMUA file Markdown (.md / .mdx), Plan, Profil, Rules & Project Scan
  // Engineer TIDAK PERNAH menyentuh file .md!
  const isMarkdownFile = /\.(md|mdx|rst|adoc)$/i.test(filePath);
  if (isMarkdownFile) {
    if (/implementation_plan\.md/i.test(filePath)) {
      const reqFeedback = a.ArtifactMetadata?.RequestFeedback === true || a.ArtifactMetadata?.RequestFeedback === 'true' || /"RequestFeedback"\s*:\s*true/i.test(String(a.ArtifactMetadata || ''));
      return {
        role: 'architect',
        phase: reqFeedback ? 'gate1' : 'plan',
        status: reqFeedback ? 'waiting' : 'working',
        message: reqFeedback ? 'Plan siap, menunggu approval' : `Menyusun ${fbase || 'plan'}`,
        gate: reqFeedback ? { n: 1, question: 'Review Implementation Plan. Approve atau revisi?' } : undefined,
        propHandoff: reqFeedback ? ['architect', 'you', 'plan.md'] : null,
      };
    }
    // Jika hanya membaca (read-only) file markdown sebagai referensi saat role aktif adalah developer / qa / scribe:
    if (isRead && (currentRole === 'developer' || currentRole === 'qa' || currentRole === 'scribe')) {
      return {
        role: currentRole,
        phase: currentRole === 'developer' ? 'code' : currentRole === 'qa' ? 'test' : 'docs',
        message: `Membaca ${fbase || 'dokumen'}`
      };
    }
    return {
      role: 'architect',
      phase: isWrite ? 'plan' : 'profile',
      message: isWrite ? `Menyusun ${fbase || 'dokumen'}` : `Membaca ${fbase || 'dokumen'}`
    };
  }

  // 5. Sticky read/diagnostik jika Engineer sedang aktif (khusus file code / terminal)
  if (currentRole === 'developer') {
    if (isRead && !isMarkdownFile) {
      return { role: 'developer', phase: 'code', message: `Periksa ${fbase || clip(filePath, 30) || 'file'}` };
    }
    if (name === 'run_command' && !cmdWrites && /^\s*(git\s+(status|branch|log|ls-files|diff|show)|node\b|npm\b|npx\b|Get-ChildItem|Select-String|Get-Content|ls|dir|cat|type)\b/i.test(cmd)) {
      return { role: 'developer', phase: 'code', message: clip(summary || `Verifikasi: ${cmd}`, 48) };
    }
  }

  // 6. Architect: scan project & generic read
  if (isRead) return { role: 'architect', phase: 'profile', message: `Scan: ${fbase || clip(filePath, 30) || name}` };
  if (name === 'run_command' && !cmdWrites && /^\s*(git\s+(status|branch|log|ls-files|diff|show)|Get-ChildItem|Select-String|Get-Content|ls|dir|cat|type)\b/i.test(cmd)) {
    return { role: 'architect', phase: 'profile', message: clip(summary || `Scan: ${cmd}`, 48) };
  }

  // 7. Engineer: eksekusi kode (hanya source code & non-markdown config)
  return { role: 'developer', phase: 'code', message: fbase ? `Edit ${fbase}` : clip(summary || cmd || name, 48) };
}

function detectAgentSwitch(tc, currentAgent) {
  if (tc.name === 'run_command') {
    const cmd = String(unquote(tc.args?.CommandLine) || '');
    if (/office-state\.mjs/.test(cmd)) {
      const mAgent = [...cmd.matchAll(/(?:office-state\.mjs["']?|\$\w+)\s+agent\s+(manager|scout|architect|developer|qa|scribe|release)\s+(working|done|waiting|blocked)/g)].pop();
      if (mAgent) {
        if (mAgent[2] === 'working') return mAgent[1];
        if (mAgent[2] === 'done') return currentAgent;
      }
      const mHandoff = [...cmd.matchAll(/(?:office-state\.mjs["']?|\$\w+)\s+handoff\s+\S+\s+(manager|scout|architect|developer|qa|scribe|release)/g)].pop();
      if (mHandoff) return mHandoff[1];
      return currentAgent;
    }
  }
  const act = inferToolAction(tc, '', currentAgent);
  return act?.role || currentAgent;
}

export function parseTranscriptFile(filePath, minTime, defaultAgent = 'architect', visited = new Set()) {
  if (!filePath || !fs.existsSync(filePath) || visited.has(filePath)) return [];
  visited.add(filePath);

  const brainRoot = path.resolve(path.dirname(filePath), '..', '..', '..');
  const out = [];
  let currentAgent = defaultAgent;

  let lines = [];
  try { lines = fs.readFileSync(filePath, 'utf8').split('\n'); } catch { return []; }

  const steps = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try { steps.push(JSON.parse(line)); } catch {}
  }

  let seenUserAfterClear = !minTime;

  for (let i = 0; i < steps.length; i++) {
    const e = steps[i];
    const at = e.created_at || new Date().toISOString();
    const isAfterClear = !minTime || (e.created_at && Date.parse(e.created_at) > minTime);

    if (e.type === 'USER_INPUT' && e.source === 'USER_EXPLICIT') {
      const cleaned = cleanUserPrompt(e.content);
      currentAgent = inferRoleFromPrompt(cleaned).role;
    } else if (e.type === 'PLANNER_RESPONSE' && Array.isArray(e.tool_calls)) {
      for (const tc of e.tool_calls) {
        currentAgent = detectAgentSwitch(tc, currentAgent);
      }
    }

    if (!isAfterClear) continue;
    if (e.type === 'USER_INPUT' && e.source === 'USER_EXPLICIT') {
      seenUserAfterClear = true;
    }
    if (!seenUserAfterClear) continue;

    if (e.type === 'USER_INPUT' && e.source === 'USER_EXPLICIT') {
      const cleanedUser = cleanUserPrompt(e.content);
      const text = summarizeForChat(cleanedUser, 'user');
      if (text) out.push({ role: 'user', at, text, md: rawForChat(cleanedUser) });
    } else if (e.type === 'PLANNER_RESPONSE') {
      if (Array.isArray(e.tool_calls)) {
        for (const tc of e.tool_calls) {
          if (tc.name === 'invoke_subagent') {
            const subRole = unquote(tc.args?.Role) || unquote(tc.args?.TypeName) || 'subagent';
            const subPrompt = summarizeForChat(unquote(tc.args?.Prompt) || '', 'user');
            out.push({ role: 'assistant', agent: currentAgent, at, text: `🤖 Delegasi [${subRole}]: ${subPrompt}`, md: rawForChat(`🤖 **Delegasi [${subRole}]:** ${subPrompt}`) });
            for (let j = i + 1; j < Math.min(steps.length, i + 5); j++) {
              if (steps[j].type === 'GENERIC' && typeof steps[j].content === 'string') {
                const mId = steps[j].content.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                if (mId) {
                  const subTranscript = path.join(brainRoot, mId[0], '.system_generated', 'logs', 'transcript.jsonl');
                  const subMsgs = parseTranscriptFile(subTranscript, minTime, `subagent:${subRole}`, visited);
                  const lastSubMsg = subMsgs.filter(m => m.role === 'assistant').pop();
                  if (lastSubMsg) out.push(lastSubMsg);
                  break;
                }
              }
            }
          }
        }
      }
      if (typeof e.content === 'string' && e.content.trim()) {
        const summary = summarizeForChat(e.content.trim(), 'assistant');
        if (summary) {
          const prev = out[out.length - 1];
          if (!prev || prev.role !== 'assistant' || prev.text !== summary) {
            out.push({ role: 'assistant', agent: currentAgent, at, text: summary, md: rawForChat(e.content) });
          }
        }
      }
    }
  }
  return out;
}

export function findLatestAntigravityTranscript() {
  const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
  if (!fs.existsSync(brainDir)) return null;
  let bestFile = null;
  let bestMtime = 0;
  try {
    for (const d of fs.readdirSync(brainDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const candidate = path.join(brainDir, d.name, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(candidate)) {
        const st = fs.statSync(candidate);
        if (st.mtimeMs > bestMtime) {
          bestMtime = st.mtimeMs;
          bestFile = candidate;
        }
      }
    }
  } catch {}
  return bestFile;
}

const MODEL_NAMES = ['Gemini 4 Argon', 'Gemini 3.8 Flash', 'Claude Opus 5.5', 'Claude Sonnet 5.5'];
const usageFile = path.join(dir, 'usage.json');

function matchModelName(raw) {
  const s = String(raw || '');
  if (/argon|gemini\s*4/i.test(s)) return 'Gemini 4 Argon';
  if (/flash|3\.8/i.test(s)) return 'Gemini 3.8 Flash';
  if (/opus/i.test(s)) return 'Claude Opus 5.5';
  if (/sonnet/i.test(s)) return 'Claude Sonnet 5.5';
  return null;
}

let usageCache = { at: 0, data: null };
export function computeModelUsage() {
  if (usageCache.data && Date.now() - usageCache.at < 10000) return usageCache.data;
  const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
  const day = Date.now() - 24 * 3600 * 1000;
  const week = Date.now() - 7 * 24 * 3600 * 1000;
  const act = Object.fromEntries(MODEL_NAMES.map(n => [n, { day: 0, week: 0 }]));
  let activeModel = null;
  try {
    const entries = [];
    for (const d of fs.readdirSync(brainDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const f = path.join(brainDir, d.name, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(f)) { const st = fs.statSync(f); if (st.mtimeMs >= week) entries.push({ f, mtime: st.mtimeMs }); }
    }
    entries.sort((a, b) => a.mtime - b.mtime);
    for (const { f } of entries) {
      let cur = activeModel;
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let e; try { e = JSON.parse(line); } catch { continue; }
        if (e.type === 'USER_INPUT' && typeof e.content === 'string') {
          const m = e.content.match(/Model Selection`\s+from\s+.+?\s+to\s+(.+?)\.\s+No need/);
          const k = m && matchModelName(m[1]);
          if (k) { cur = k; activeModel = k; }
        }
        if (e.type === 'PLANNER_RESPONSE' && cur) {
          const t = e.created_at ? Date.parse(e.created_at) : 0;
          if (t >= week) act[cur].week++;
          if (t >= day) act[cur].day++;
        }
      }
    }
  } catch {}
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(usageFile, 'utf8')); } catch {}
  const DEFAULT_QUOTAS = {
    'Gemini 4 Argon':    [{ label: 'Daily / 5h', remaining: 82 }, { label: 'Weekly', remaining: 90 }],
    'Gemini 3.8 Flash':  [{ label: 'Daily / 5h', remaining: 95 }, { label: 'Weekly', remaining: 98 }],
    'Claude Opus 5.5':   [{ label: 'Daily / 5h', remaining: 88 }, { label: 'Weekly', remaining: 92 }],
    'Claude Sonnet 5.5': [{ label: 'Daily / 5h', remaining: 85 }, { label: 'Weekly', remaining: 89 }],
  };
  const data = {
    updatedAt: cfg.updatedAt || null,
    models: MODEL_NAMES.map(name => {
      const custom = (cfg.models?.[name]?.quotas || []).filter(q => q && q.label && q.remaining !== '' && q.remaining != null);
      return {
        name,
        active: name === activeModel,
        activity: act[name],
        quotas: custom.length ? custom : (DEFAULT_QUOTAS[name] || []),
      };
    }),
  };
  usageCache = { at: Date.now(), data };
  return data;
}

export function saveUsageConfig(body) {
  const models = {};
  for (const name of MODEL_NAMES) {
    const quotas = (body?.models?.[name]?.quotas || [])
      .map(q => ({ label: String(q.label || '').slice(0, 20), remaining: Math.max(0, Math.min(100, Number(q.remaining))), resetAt: String(q.resetAt || '').slice(0, 40) }))
      .filter(q => q.label && Number.isFinite(q.remaining));
    models[name] = { quotas };
  }
  writeJsonSafe(usageFile, { updatedAt: new Date().toISOString(), models });
  usageCache = { at: 0, data: null };
}

export function resetVisualizer() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
  const fresh = {
    task: null, phase: 'intake', gate: null,
    agents: Object.fromEntries(AGENTS.map(a => [a, { status: 'idle', message: '' }])),
    handoffs: [], handoffSeq: Number(s.handoffSeq || 0), log: [],
    clearedAt: new Date().toISOString(),
  };
  writeJsonSafe(stateFile, fresh);
  try { fs.rmSync(chatFile, { force: true }); } catch {}
}

const ROLES = ['architect', 'developer', 'qa', 'scribe'];

/**
 * Sinkronisasi otomatis .office/state.json dari transcript Antigravity terbaru.
 */
export function syncStateFromTranscript() {
  const latestTranscript = findLatestAntigravityTranscript();
  if (!latestTranscript) return null;

  let curState = {};
  try { curState = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
  const minTime = curState.clearedAt ? Date.parse(curState.clearedAt) : 0;
  const userName = getUserName();

  let lines = [];
  try { lines = fs.readFileSync(latestTranscript, 'utf8').split('\n'); } catch { return curState; }
  const allSteps = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try { allSteps.push(JSON.parse(line)); } catch {}
  }

  const steps = [];
  let seenUser = !minTime;
  for (const e of allSteps) {
    const isAfter = !minTime || (e.created_at && Date.parse(e.created_at) > minTime);
    if (!isAfter) continue;
    if (e.type === 'USER_INPUT' && e.source === 'USER_EXPLICIT') seenUser = true;
    if (seenUser) steps.push(e);
  }
  if (steps.length === 0) return curState;

  const convId = path.basename(path.resolve(path.dirname(latestTranscript), '..', '..'));
  const convTitle = getConversationTitle(convId);
  const lastStep = steps[steps.length - 1];
  const cursor = `${convId}:${steps.length}:${lastStep.step_index}:${lastStep.type}:${lastStep.status}`;
  if (curState.transcriptSync?.cursor === cursor) return curState;

  const sameConv = curState.transcriptSync?.convId === convId;
  const defaultProject = path.basename(root) || 'ai-engineering-office';

  const s = {
    task: sameConv ? (curState.task || null) : null,
    phase: sameConv ? (curState.phase || 'intake') : 'intake',
    gate: sameConv ? (curState.gate || null) : null,
    agents: Object.fromEntries(AGENTS.map(a => [a, (sameConv && curState.agents?.[a]) || { status: 'idle', message: '' }])),
    handoffs: sameConv && Array.isArray(curState.handoffs) ? [...curState.handoffs] : [],
    handoffSeq: Number(curState.handoffSeq || 0),
    log: sameConv && Array.isArray(curState.log) ? [...curState.log] : [],
    turn: sameConv && curState.turn ? { ...curState.turn, participants: [...(curState.turn.participants || [])] } : { participants: [], done: false },
    userName,
    ...(curState.clearedAt ? { clearedAt: curState.clearedAt } : {}),
  };

  if (s.task && convTitle && s.task.title !== convTitle) {
    s.task.title = convTitle;
  }

  const addHandoff = (from, to, label) => {
    if (!from || !to || from === to) return;
    const cleanLabel = String(label || '').slice(0, 24);
    const prev = s.handoffs && s.handoffs[s.handoffs.length - 1];
    if (prev && prev.from === from && prev.to === to && prev.label === cleanLabel) return;
    s.handoffSeq += 1;
    s.handoffs.push({ n: s.handoffSeq, from, to, label: cleanLabel, at: new Date().toISOString() });
    s.handoffs = s.handoffs.slice(-20);
  };
  const addLog = (text, at) => {
    const prev = s.log[s.log.length - 1];
    if (prev && prev.text === text) return;
    s.log.push({ at: at || new Date().toISOString(), text });
    s.log = s.log.slice(-100);
  };
  const join = r => { if (ROLES.includes(r) && !s.turn.participants.includes(r)) s.turn.participants.push(r); };

  const startIdx = sameConv ? Math.max(0, Number(curState.transcriptSync?.stepCount || 0)) : 0;
  let activeRole = ROLES.find(r => ['working', 'waiting', 'blocked'].includes(s.agents[r]?.status)) || 'architect';

  for (let i = startIdx; i < steps.length; i++) {
    const e = steps[i];
    const at = e.created_at || new Date().toISOString();

    if (e.type === 'USER_INPUT' && e.source === 'USER_EXPLICIT') {
      const proj = extractProjectFromMetadata(e.content);
      const promptText = cleanUserPrompt(e.content);
      const summary = summarizeForChat(promptText, 'user');
      const firstLine = promptText.split(/\r?\n/).map(l => l.trim()).find(Boolean) || summary;

      if (!s.task) {
        s.task = {
          id: convId.slice(0, 8),
          title: convTitle || 'Percakapan Antigravity',
          project: proj || defaultProject,
          branch: '-',
          mode: 'A'
        };
      } else {
        if (convTitle && s.task.title !== convTitle) {
          s.task.title = convTitle;
        }
        if (proj && proj !== 'workspace' && proj !== 'logs' && s.task.project !== proj) {
          s.task.project = proj;
        }
      }

      // Prompt baru: semua peran kembali idle
      const wasGate = s.gate?.n;
      AGENTS.forEach(a => { s.agents[a] = { status: 'idle', message: '' }; });
      s.turn = { participants: [], done: false };

      const isReject = (s.phase === 'gate1' || wasGate === 1 || /\b(tolak|revisi|reject)\b/i.test(promptText)) &&
        !/^\s*(ya|yes|ok|oke|setuju|approve|proceed|lanjut|gas|1\.\s*iya)\b/i.test(promptText) &&
        /\b(tolak|revisi|reject|kurang|belum|jangan|ubah\s+plan)\b/i.test(promptText);
      s.gate = null;

      if (isReject) {
        s.phase = 'plan';
        activeRole = 'architect';
        s.agents.architect = { status: 'working', message: `Diskusi revisi plan dengan ${userName}` };
        addHandoff('you', 'architect', 'Tolak plan: revisi');
        addLog(`${userName} menolak/revisi plan: ${clip(summary, 60)}`, at);
      } else {
        const inferred = wasGate === 1 ? { role: 'developer', phase: 'code' } : inferRoleFromPrompt(promptText);
        // ALUR WAJIB: Selalu ke Architect terlebih dahulu!
        addHandoff('you', 'architect', wasGate ? 'approve' : 'prompt');
        addLog(`${userName}: ${clip(summary, 70)}`, at);
        join('architect');

        if (inferred.role !== 'architect') {
          // Architect langsung mendelegasikan ke role spesialis
          addHandoff('architect', inferred.role, 'task');
          activeRole = inferred.role;
          s.phase = inferred.phase;
          s.agents.architect = { status: 'idle', message: '' };
          s.agents[activeRole] = { status: 'working', message: `Menerima delegasi: ${clip(firstLine, 42)}` };
          join(activeRole);
        } else {
          activeRole = 'architect';
          s.phase = inferred.phase;
          s.agents.architect = { status: 'working', message: `Menerima instruksi: ${clip(firstLine, 42)}` };
        }
      }
      join(activeRole);
    } else if (e.type === 'PLANNER_RESPONSE') {
      const tcs = Array.isArray(e.tool_calls) ? e.tool_calls : [];
      if (tcs.length > 0) {
        let genericTexts = '';
        for (let j = i + 1; j < steps.length && steps[j].type === 'GENERIC'; j++) genericTexts += '\n' + String(steps[j].content || '');
        const mBranch = genericTexts.match(/^\*\s+([A-Za-z0-9._/-]+)\s*$/m);
        if (mBranch && s.task) s.task.branch = mBranch[1];

        for (const tc of tcs) {
          // Deteksi dinamis nama project dari tool call bila project belum spesifik
          if (!s.task || s.task.project === 'workspace' || s.task.project === 'logs' || s.task.project === defaultProject) {
            const pathArg = tc.args?.Path || tc.args?.FilePath || tc.args?.CommandLine || '';
            const detected = extractProjectFromPath(String(unquote(pathArg)));
            if (detected && detected !== 'logs' && s.task) s.task.project = detected;
          }

          // Cek bila agent menjalankan office-state.mjs secara manual
          if (tc.name === 'run_command') {
            const rawCmd = String(unquote(tc.args?.CommandLine) || '');
            if (/office-state\.mjs/.test(rawCmd)) {
              const mH = [...rawCmd.matchAll(/handoff\s+([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_-]+)\s+["']?([^"']+)["']?/g)].pop();
              if (mH) addHandoff(mH[1], mH[2], mH[3]);
              const mA = [...rawCmd.matchAll(/agent\s+([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_-]+)\s+["']?([^"']*)["']?/g)].pop();
              if (mA) s.agents[mA[1]] = { status: mA[2], message: clip(mA[3] || '', 60) };
              const mP = [...rawCmd.matchAll(/phase\s+([a-zA-Z0-9_-]+)/g)].pop();
              if (mP) s.phase = mP[1];
              continue;
            }
          }

          const act = inferToolAction(tc, genericTexts, activeRole);
          if (!act) continue;
          if (activeRole && activeRole !== act.role) {
            if (s.agents[activeRole]?.status === 'working') s.agents[activeRole] = { status: 'idle', message: '' };
            addHandoff(activeRole, act.role, 'task');
          }
          activeRole = act.role;
          join(activeRole);
          s.phase = act.phase;
          s.agents[act.role] = { status: act.status || 'working', message: act.message };
          if (act.gate !== undefined) s.gate = act.gate;
          if (act.propHandoff) addHandoff(act.propHandoff[0], act.propHandoff[1], act.propHandoff[2]);
          addLog(`${act.role}: ${act.message}`, at);
        }
      } else if (typeof e.content === 'string' && e.content.trim()) {
        const txt = e.content.trim();
        const asksApproval = /\b(approve|setuju|proceed|revisi)\b[\s\S]{0,120}\?/i.test(txt);
        if (asksApproval || s.gate) {
          if (!s.gate) {
            const gNum = s.phase === 'docs' ? 2 : s.phase === 'release' ? 3 : 1;
            if (gNum === 1) s.phase = 'gate1';
            else if (gNum === 2) s.phase = 'gate2';
            s.gate = { n: gNum, question: clip(summarizeForChat(txt, 'assistant'), 90) };
          }
          s.agents[activeRole] = { status: 'waiting', message: `Menunggu keputusan ${userName}` };
          addHandoff(activeRole, 'you', 'review');
        } else if (!steps.slice(i + 1).some(x => x.type === 'PLANNER_RESPONSE' || (x.type === 'USER_INPUT' && x.source === 'USER_EXPLICIT'))) {
          s.turn.done = true;
          s.phase = 'done';
          s.turn.participants.forEach(r => {
            if (s.agents[r]?.status !== 'blocked') s.agents[r] = { status: 'done', message: 'Selesai' };
          });
          addHandoff(activeRole, 'you', 'jawaban');
        }
      }
    }
  }

  const lastIsRunning = lastStep.type === 'USER_INPUT' || lastStep.type === 'GENERIC' ||
    (lastStep.type === 'PLANNER_RESPONSE' && Array.isArray(lastStep.tool_calls) && lastStep.tool_calls.length > 0);
  if (lastIsRunning) {
    s.turn.done = false;
    if (s.phase === 'done') s.phase = 'code';
    if (!['blocked', 'waiting'].includes(s.agents[activeRole]?.status)) {
      const curMsg = s.agents[activeRole]?.message;
      const safeMsg = (!curMsg || curMsg === 'Selesai') ? 'Sedang mengerjakan...' : curMsg;
      s.agents[activeRole] = { status: 'working', message: safeMsg };
    }
    for (const r of AGENTS) {
      if (r !== activeRole && s.agents[r]?.status === 'done') {
        s.agents[r] = { status: 'idle', message: '' };
      }
    }
  }

  s.transcriptSync = { convId, stepCount: steps.length, cursor, syncedAt: new Date().toISOString() };
  s.updatedAt = new Date().toISOString();
  writeJsonSafe(stateFile, s);
  return s;
}

export function buildMirroredChat() {
  let clearedAt = null;
  try { clearedAt = JSON.parse(fs.readFileSync(stateFile, 'utf8')).clearedAt; } catch {}
  const minTime = clearedAt ? Date.parse(clearedAt) : 0;

  let fileMsgs = [];
  try {
    fileMsgs = (JSON.parse(fs.readFileSync(chatFile, 'utf8')).messages || [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ ...m, md: m.md || rawForChat(m.text), text: summarizeForChat(m.text, m.role) }));
  } catch {}

  const latestTranscript = findLatestAntigravityTranscript();
  const transcriptMsgs = latestTranscript ? parseTranscriptFile(latestTranscript, minTime, 'architect') : [];

  if (transcriptMsgs.length === 0) {
    const clean = fileMsgs.slice(-100).map((m, idx) => ({ ...m, n: idx + 1 }));
    return { seq: clean.length, messages: clean };
  }

  const merged = transcriptMsgs.slice(-100).map((m, idx) => ({ n: idx + 1, ...m }));
  return { seq: merged.length, messages: merged };
}

export function syncChatFileToDisk() {
  try {
    syncStateFromTranscript();
    const data = buildMirroredChat();
    writeJsonSafe(chatFile, data);
  } catch {}
}
