import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.office');
const stateFile = path.join(dir, 'state.json');
const chatFile = path.join(dir, 'chat.json');
const configFile = path.join(dir, 'config.json');

export const MODEL_META = {
  argon:  { id: 'argon',  name: 'Gemini 4 Argon',    pattern: /argon|gemini\s*4/i },
  flash:  { id: 'flash',  name: 'Gemini 3.8 Flash',  pattern: /flash|3\.8/i },
  opus:   { id: 'opus',   name: 'Claude Opus 5.5',   pattern: /opus/i },
  sonnet: { id: 'sonnet', name: 'Claude Sonnet 5.5', pattern: /sonnet/i },
};

export const MODEL_AGENTS = Object.keys(MODEL_META);
export const MODEL_NAMES = Object.values(MODEL_META).map(m => m.name);

export const clip = (t, n) => { t = String(t ?? '').replace(/\s+$/g, ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
export const base = p => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';

function unquote(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

export function readJsonSafe(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

export function writeJsonSafe(target, obj) {
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

export function canonAgent(raw, fallback = 'flash') {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return fallback;
  if (s === 'argon' || s === 'gemini-4-argon' || s === 'gemini 4 argon') return 'argon';
  if (s === 'flash' || s === 'gemini-3-8-flash' || s === 'gemini-3.8-flash' || s === 'gemini 3.8 flash' || s === 'flash_lite') return 'flash';
  if (s === 'opus' || s === 'claude-opus-5-5' || s === 'claude-opus-5.5' || s === 'claude opus 5.5') return 'opus';
  if (s === 'sonnet' || s === 'claude-sonnet-5-5' || s === 'claude-sonnet-5.5' || s === 'claude sonnet 5.5') return 'sonnet';
  for (const [id, m] of Object.entries(MODEL_META)) {
    if (m.pattern.test(s)) return id;
  }
  return fallback;
}

export function matchModelName(raw) {
  const s = String(raw || '');
  for (const m of Object.values(MODEL_META)) {
    if (m.pattern.test(s)) return m.name;
  }
  return null;
}

export function modelIdFromName(name) {
  for (const [id, m] of Object.entries(MODEL_META)) {
    if (m.name.toLowerCase() === String(name || '').toLowerCase() || m.pattern.test(name)) return id;
  }
  return 'flash';
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

  // Fallback: check brain/<convId> artifacts
  const brainDir = path.join(home, '.gemini', 'antigravity', 'brain', convId);
  for (const art of ['implementation_plan.md', 'plan.md', 'task.md', 'walkthrough.md']) {
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

export function extractProjectFromPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  const raw = unquote(filePath);
  const normalized = String(raw).replace(/\\+/g, '/').replace(/\/+/g, '/');
  if (/\.gemini[\\/]antigravity/i.test(raw) || /\.gemini\/antigravity/i.test(normalized)) return null;

  const mWs = normalized.match(/\/workspace\/([^/]+)/i);
  if (mWs && mWs[1] && mWs[1] !== 'workspace') {
    return mWs[1];
  }

  try {
    const cfgContent = fs.readFileSync(path.join(root, 'office.config.yml'), 'utf8');
    const knownProjects = [...cfgContent.matchAll(/name:\s*([A-Za-z0-9._-]+)/g)].map(m => m[1]);
    for (const kp of knownProjects) {
      if (normalized.toLowerCase().includes(kp.toLowerCase())) return kp;
    }
  } catch {}

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
  const m = String(raw).match(/(?:Active Document|Other open documents:\s*-)\s*([A-Za-z]:\\[^\r\n("';]+|\/[^\r\n("';]+)/i);
  if (m) {
    const p = extractProjectFromPath(m[1].trim());
    if (p && /^[A-Za-z0-9._-]+$/.test(p)) return p;
  }
  try {
    const cfgContent = fs.readFileSync(path.join(root, 'office.config.yml'), 'utf8');
    const knownProjects = [...cfgContent.matchAll(/name:\s*([A-Za-z0-9._-]+)/g)].map(m => m[1]);
    for (const kp of knownProjects) {
      if (new RegExp(`\\b${kp}\\b`, 'i').test(raw)) return kp;
    }
  } catch {}
  return null;
}

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

export function rawForChat(raw, max = Infinity) {
  const t = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return '';
  if (t.length <= max || !Number.isFinite(max)) return t;
  const cut = t.slice(0, max);
  const nl = cut.lastIndexOf('\n');
  return (nl > max * 0.6 ? cut.slice(0, nl) : cut).replace(/\s+$/, '') + '\n…';
}

export function inferPhaseFromPrompt(promptText) {
  const t = String(promptText || '');
  if (/docmost|strand|tech\s*doc|\btd\b|\brfc\b|doc\s+scribing|scribe/i.test(t)) return 'docs';
  if (/unit\s*test|test\s*case|\bsdet\b|xunit|jest|vitest/i.test(t) && !/visualizer/i.test(t)) return 'test';
  if (/scan\s+project|implementation\s+plan|arsitektur|pros.*cons|assess|plan/i.test(t)) return 'plan';
  if (/\b(code|kode|endpoint|fix|bug|refactor|implement|posisi)\b/i.test(t) || /jira|pull\s*request|\bpr\b|branch|commit|push/i.test(t)) return 'code';
  return 'intake';
}


const IGNORE_TOOLS = /^(manage_task|schedule|ask_question|send_message|manage_subagents)$/i;

/**
 * Accurately infers action message and workflow phase for the active model agent.
 * Fixes Requirement 2: in-place edits (edit_file / Edit / MultiEdit) on implementation_plan.md
 * display "Editing implementation_plan.md" and do NOT regress the active phase back to 'plan'.
 */
export function inferToolAction(tc, genericContent = '', currentRole = 'flash', currentPhase = 'code') {
  const name = tc.name || '';
  if (IGNORE_TOOLS.test(name)) return null;

  const a = tc.args || {};
  const cmd = String(unquote(a.CommandLine || a.command) || '');
  const filePath = String(unquote(a.Path || a.TargetFile || a.FilePath || a.AbsolutePath || a.file_path || a.Pattern || a.Query || a.query) || '');
  const fbase = base(filePath);
  const summary = String(unquote(a.toolSummary) || '');

  const isRead = /^(read_file|view_file|list_dir|Read)$/i.test(name);
  const isSearch = /^(grep_search|find_by_name|Grep|Glob)$/i.test(name);
  const isEdit = /^(edit_file|Edit|MultiEdit|NotebookEdit|replace_file_content|multi_replace_file_content)$/i.test(name) || (name === 'write_file' && a.Append === true);
  const isCreate = !isRead && !isSearch && !isEdit && /^(write_file|create_file|Write)$/i.test(name);

  const active = canonAgent(currentRole);

  if (name === 'run_command' && /office-state\.mjs|office-hook\.mjs/i.test(cmd)) {
    return null;
  }

  // 1. Docmost / Strand MCP tools
  const isDocmostTool = /strand|docmost/i.test(name) || /^(search_pages|list_pages|get_page|create_page|update_page|create_page_from_template|list_templates|get_template|delete_page|move_page)$/i.test(name);
  if (isDocmostTool) {
    const tool = name.replace(/^mcp_[^_]+_/, '');
    const isWritingDocmost = /create|update|write|edit|append|publish|move/i.test(tool);
    return {
      role: active,
      phase: 'docs',
      message: isWritingDocmost ? `Publishing doc: ${clip(tool, 30)}` : `Reading Docmost: ${clip(tool, 30)}`,
      propHandoff: isWritingDocmost ? [active, 'docmost', 'Push Doc'] : null
    };
  }
  if (/docs-draft\.md$/i.test(filePath)) {
    return {
      role: active,
      phase: 'docs',
      message: isEdit ? `Editing ${fbase}` : isCreate ? `Writing ${fbase}` : `Reading ${fbase}`,
      propHandoff: null
    };
  }

  // 2. Unit test execution
  if (name === 'run_command' && /\b(dotnet\s+test|npm\s+(run\s+)?test|npx\s+(jest|vitest|mocha)|yarn\s+test|pnpm\s+test|pytest|node\s+--test)\b/i.test(cmd)) {
    const failed = /Command exited with code [^0]|FAIL\s|Failed!|Test Run Failed/i.test(genericContent);
    let errMsg = '';
    if (failed) {
      const names = [...genericContent.matchAll(/(?:Failed|FAIL|\u2715|\u00d7)\s+([A-Za-z0-9_.:-]+)/g)].map(m => m[1]);
      errMsg = names.length ? [...new Set(names)].slice(0, 4).join('; ') : 'Unit test failed (non-green flow)';
    }
    return {
      role: active,
      phase: 'test',
      status: failed ? 'blocked' : 'working',
      message: failed ? errMsg : `Running tests: ${clip(summary || cmd, 56)}`,
      propHandoff: failed ? [active, active, 'test error'] : null,
    };
  }
  if (/Tests?\.(cs|js|ts|jsx|tsx)$/i.test(filePath)) {
    return {
      role: active,
      phase: 'test',
      message: isEdit ? `Editing ${fbase}` : isCreate ? `Writing ${fbase}` : `Reading ${fbase}`
    };
  }

  // 3. Git, PR & Jira operations
  if (name === 'run_command' && /\bgit\s+commit\b/i.test(cmd)) {
    return { role: active, phase: 'code', message: `Commit to Git: ${clip(cmd, 36)}`, propHandoff: [active, 'github', 'Commit'] };
  }
  if (name === 'run_command' && /\bgit\s+(checkout\s+-b|switch\s+-c)\b/i.test(cmd)) {
    return { role: active, phase: 'branch', message: `Create branch: ${clip(cmd, 36)}`, propHandoff: [active, 'github', 'Branch'] };
  }
  if (name === 'run_command' && /\bgit\s+push\b/i.test(cmd)) {
    return { role: active, phase: 'release', message: 'Push branch to GitHub', propHandoff: [active, 'github', 'Push Branch'] };
  }
  if ((name === 'run_command' && /\bgh\s+pr\b/i.test(cmd)) || /create_pull_request/i.test(name)) {
    return { role: active, phase: 'release', message: 'Create Pull Request on GitHub', propHandoff: [active, 'github', 'Create PR'] };
  }
  if (/pr\.html|pull_request_template/i.test(filePath)) {
    return { role: active, phase: 'release', message: isRead ? 'Reading PR template' : isEdit ? 'Editing PR description' : 'Drafting PR description', propHandoff: isRead ? null : [active, 'github', 'Draft PR'] };
  }
  if (/jira/i.test(name) || /jira\.md$/i.test(filePath)) {
    return { role: active, phase: 'release', message: isRead ? 'Reading Jira task' : isEdit ? 'Editing Jira task' : 'Drafting Jira task', propHandoff: isRead ? null : [active, 'jira', 'Write Jira'] };
  }

  // 4. Implementation plan files
  if (/implementation_plan\.md/i.test(filePath)) {
    const reqFeedback = a.ArtifactMetadata?.RequestFeedback === true || a.ArtifactMetadata?.RequestFeedback === 'true' || /"RequestFeedback"\s*:\s*true/i.test(String(a.ArtifactMetadata || ''));
    if (reqFeedback) {
      return {
        role: active,
        phase: 'gate1',
        status: 'waiting',
        message: 'Plan ready, awaiting approval',
        gate: { n: 1, question: 'Review Implementation Plan. Approve or revise?' },
        propHandoff: [active, 'you', 'plan.md'],
      };
    }
    if (isEdit) {
      return {
        role: active,
        phase: currentPhase || 'code',
        message: `Editing ${fbase || 'implementation_plan.md'}`
      };
    }
    return {
      role: active,
      phase: 'plan',
      message: `Drafting ${fbase || 'implementation_plan.md'}`
    };
  }

  // 5. Generic Markdown documents
  const isMarkdownFile = /\.(md|mdx|rst|adoc)$/i.test(filePath);
  if (isMarkdownFile) {
    if (isEdit) {
      return {
        role: active,
        phase: currentPhase || 'code',
        message: `Editing ${fbase || 'document'}`
      };
    }
    if (isCreate) {
      return {
        role: active,
        phase: currentPhase === 'profile' ? 'profile' : 'plan',
        message: `Writing ${fbase || 'document'}`
      };
    }
    return {
      role: active,
      phase: currentPhase || 'profile',
      message: `Reading ${fbase || 'document'}`
    };
  }

  // 6. Generic search or read operations
  if (isSearch) {
    const query = a.Query || a.query || a.Pattern || a.pattern || '';
    return { role: active, phase: currentPhase || 'code', message: `Searching: ${clip(query || fbase, 32)}` };
  }
  if (isRead) {
    return { role: active, phase: currentPhase || 'code', message: `Reading ${fbase || clip(filePath, 30) || name}` };
  }
  if (name === 'run_command' && /^\s*(git\s+(status|branch|log|ls-files|diff|show)|Get-ChildItem|Select-String|Get-Content|Get-Process|Get-NetTCPConnection|Get-CimInstance|ls|dir|cat|type)\b/i.test(cmd)) {
    return { role: active, phase: currentPhase || 'code', message: clip(summary || `Checking: ${cmd}`, 56) };
  }

  // 7. Generic file edits / creations / commands
  if (isCreate) {
    return { role: active, phase: 'code', message: `Creating ${fbase || clip(filePath, 30) || 'file'}` };
  }
  if (name === 'run_command') {
    return { role: active, phase: currentPhase || 'code', message: summary ? clip(summary, 56) : `Running: ${clip(cmd, 46)}` };
  }
  return { role: active, phase: 'code', message: fbase ? `Editing ${fbase}` : clip(summary || cmd || name, 56) };
}

export function getLastSelectedModel() {
  const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
  if (!fs.existsSync(brainDir)) return 'flash';
  let candidate = 'flash';

  try {
    const entries = [];
    for (const d of fs.readdirSync(brainDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const f = path.join(brainDir, d.name, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(f)) {
        entries.push({ f, mtime: fs.statSync(f).mtimeMs });
      }
    }
    entries.sort((a, b) => b.mtime - a.mtime);
    for (const { f } of entries.slice(0, 10)) {
      const content = fs.readFileSync(f, 'utf8');
      const matches = [...content.matchAll(/Model Selection`\s+from\s+.+?\s+to\s+(.+?)\.\s+No need/g)];
      if (matches.length > 0) {
        const last = matches[matches.length - 1][1];
        const m = matchModelName(last);
        if (m) return modelIdFromName(m);
      }
    }
  } catch {}
  return candidate;
}

export function parseTranscriptFile(filePath, minTime, defaultAgent = 'flash', visited = new Set()) {
  if (!filePath || !fs.existsSync(filePath) || visited.has(filePath)) return [];
  visited.add(filePath);

  const brainRoot = path.resolve(path.dirname(filePath), '..', '..', '..');
  const fullTranscriptPath = path.join(path.dirname(filePath), 'transcript_full.jsonl');
  let fullTranscriptLines = null;

  function resolveFullContent(step, lineIdx) {
    if (!step) return '';
    if (Array.isArray(step.truncated_fields) && step.truncated_fields.includes('content') && fs.existsSync(fullTranscriptPath)) {
      if (fullTranscriptLines === null) {
        try { fullTranscriptLines = fs.readFileSync(fullTranscriptPath, 'utf8').split('\n'); } catch { fullTranscriptLines = []; }
      }
      if (lineIdx < fullTranscriptLines.length && fullTranscriptLines[lineIdx].trim()) {
        try {
          const parsed = JSON.parse(fullTranscriptLines[lineIdx]);
          if (parsed.step_index === step.step_index && typeof parsed.content === 'string') {
            return parsed.content;
          }
        } catch {}
      }
      for (const fl of fullTranscriptLines) {
        if (!fl.trim()) continue;
        try {
          const parsed = JSON.parse(fl);
          if (parsed.step_index === step.step_index && typeof parsed.content === 'string') {
            return parsed.content;
          }
        } catch {}
      }
    }
    return typeof step.content === 'string' ? step.content : '';
  }

  const out = [];
  let currentAgent = canonAgent(defaultAgent);

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

    if (e.type === 'USER_INPUT' && typeof e.content === 'string') {
      const mSet = e.content.match(/Model Selection`\s+from\s+.+?\s+to\s+(.+?)\.\s+No need/);
      if (mSet && mSet[1]) {
        const matched = matchModelName(mSet[1]);
        if (matched) currentAgent = modelIdFromName(matched);
      }
    }

    if (!isAfterClear) continue;
    if (e.type === 'USER_INPUT' && e.source === 'USER_EXPLICIT') {
      seenUserAfterClear = true;
    }
    if (!seenUserAfterClear) continue;

    if (e.type === 'USER_INPUT' && e.source === 'USER_EXPLICIT') {
      const rawUser = resolveFullContent(e, i);
      const cleanedUser = cleanUserPrompt(rawUser);
      if (cleanedUser) {
        out.push({ role: 'user', at, text: cleanedUser, md: rawForChat(cleanedUser) });
      }
    } else if (e.type === 'PLANNER_RESPONSE') {
      if (Array.isArray(e.tool_calls)) {
        for (const tc of e.tool_calls) {
          if (tc.name === 'invoke_subagent') {
            const subRole = unquote(tc.args?.Role) || unquote(tc.args?.TypeName) || 'subagent';
            const subModelArg = unquote(tc.args?.Model);
            const subModelId = subModelArg && subModelArg !== 'inherit' ? canonAgent(subModelArg, currentAgent) : currentAgent;
            const subPrompt = unquote(tc.args?.Prompt) || '';
            out.push({
              role: 'assistant',
              agent: currentAgent,
              at,
              text: `🤖 Delegated [${MODEL_META[subModelId]?.name || subRole}]: ${subPrompt}`,
              md: rawForChat(`🤖 **Delegated [${MODEL_META[subModelId]?.name || subRole}]:**\n\n${subPrompt}`)
            });
            for (let j = i + 1; j < Math.min(steps.length, i + 5); j++) {
              if (steps[j].type === 'GENERIC' && typeof steps[j].content === 'string') {
                const mId = steps[j].content.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                if (mId) {
                  const subTranscript = path.join(brainRoot, mId[0], '.system_generated', 'logs', 'transcript.jsonl');
                  const subMsgs = parseTranscriptFile(subTranscript, minTime, subModelId, visited);
                  const lastSubMsg = subMsgs.filter(m => m.role === 'assistant').pop();
                  if (lastSubMsg) out.push(lastSubMsg);
                  break;
                }
              }
            }
          }
        }
      }
      const rawAssistant = resolveFullContent(e, i).trim();
      if (rawAssistant) {
        const prev = out[out.length - 1];
        if (!prev || prev.role !== 'assistant' || prev.text !== rawAssistant) {
          out.push({ role: 'assistant', agent: currentAgent, at, text: rawAssistant, md: rawForChat(rawAssistant) });
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

export function getModelsStatus(currentActive = 'flash') {
  const active = canonAgent(currentActive);
  return {
    models: MODEL_AGENTS.map(id => ({
      id,
      name: MODEL_META[id].name,
      active: id === active,
    }))
  };
}

export function resetVisualizer() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
  const fresh = {
    task: null, phase: 'intake', gate: null,
    activeAgent: 'flash',
    agents: Object.fromEntries(MODEL_AGENTS.map(a => [a, { status: 'idle', message: '' }])),
    handoffs: [], handoffSeq: Number(s.handoffSeq || 0), log: [],
    clearedAt: new Date().toISOString(),
  };
  writeJsonSafe(stateFile, fresh);
  try { fs.rmSync(chatFile, { force: true }); } catch {}
}

/**
 * Live synchronization from transcript into .office/state.json.
 * Centralized on the active AI model agent.
 */
export function syncStateFromTranscript(options = {}) {
  const targetStateFile = options.stateFilePath || stateFile;
  const latestTranscript = options.transcriptPath || findLatestAntigravityTranscript();
  if (!latestTranscript) return null;

  let curState = {};
  try { curState = JSON.parse(fs.readFileSync(targetStateFile, 'utf8')); } catch {}
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

  let activeModel = canonAgent(curState.activeAgent || getLastSelectedModel());

  const s = {
    task: sameConv ? (curState.task || null) : null,
    phase: sameConv ? (curState.phase || 'intake') : 'intake',
    gate: sameConv ? (curState.gate || null) : null,
    activeAgent: activeModel,
    agents: Object.fromEntries(MODEL_AGENTS.map(a => [a, (sameConv && curState.agents?.[a]) || { status: 'idle', message: '' }])),
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
  const latestLoggedAction = agentId => {
    const prefix = `${MODEL_META[agentId]?.name || agentId}: `;
    const uPrefix1 = `${userName}: `;
    const uPrefix2 = `${userName} requested `;
    for (let k = s.log.length - 1; k >= 0; k--) {
      const t = String(s.log[k]?.text || '');
      if (t.startsWith(prefix)) {
        const actText = t.slice(prefix.length).trim();
        if (actText && actText !== 'Done' && actText !== 'Working...') return actText;
      }
      if (t.startsWith(uPrefix1) || t.startsWith(uPrefix2)) break;
    }
    return '';
  };
  const setAgentActivity = (agentId, status, message, at, alsoLog = true) => {
    s.agents[agentId] = { status, message };
    if (alsoLog && message && message !== 'Done' && message !== 'Working...') {
      addLog(`${MODEL_META[agentId]?.name || agentId}: ${message}`, at);
    }
  };
  const join = r => {
    const c = canonAgent(r);
    if (!s.turn.participants.includes(c)) s.turn.participants.push(c);
  };

  const startIdx = sameConv ? Math.max(0, Number(curState.transcriptSync?.stepCount || 0)) : 0;

  for (let i = startIdx; i < steps.length; i++) {
    const e = steps[i];
    const at = e.created_at || new Date().toISOString();

    // Check for Model Selection changes
    if (e.type === 'USER_INPUT' && typeof e.content === 'string') {
      const mSet = e.content.match(/Model Selection`\s+from\s+.+?\s+to\s+(.+?)\.\s+No need/);
      if (mSet && mSet[1]) {
        const matched = matchModelName(mSet[1]);
        if (matched) {
          const nextModel = modelIdFromName(matched);
          if (nextModel !== activeModel) {
            addHandoff(activeModel, nextModel, 'switch model');
            addLog(`Model switched to ${matched}`, at);
            activeModel = nextModel;
            s.activeAgent = activeModel;
          }
        }
      }
    }

    if (e.type === 'USER_INPUT' && e.source === 'USER_EXPLICIT') {
      const proj = extractProjectFromMetadata(e.content);
      const promptText = cleanUserPrompt(e.content);
      const summary = summarizeForChat(promptText, 'user');

      if (!s.task) {
        s.task = {
          id: convId.slice(0, 8),
          title: convTitle || 'Antigravity Session',
          project: proj || defaultProject,
          branch: '-'
        };
      } else {
        if (convTitle && s.task.title !== convTitle) {
          s.task.title = convTitle;
        }
        if (proj && proj !== 'workspace' && proj !== 'logs' && /^[A-Za-z0-9._-]+$/.test(proj) && s.task.project !== proj) {
          s.task.project = proj;
        }
      }

      const wasGate = s.gate?.n;
      MODEL_AGENTS.forEach(a => { s.agents[a] = { status: 'idle', message: '' }; });
      s.turn = { participants: [], done: false };

      const isReject = (s.phase === 'gate1' || wasGate === 1 || /\b(tolak|revisi|reject|kurang|ubah\s+plan)\b/i.test(promptText)) &&
        !/^\s*(ya|yes|ok|oke|setuju|approve|proceed|lanjut|gas|1\.\s*iya)\b/i.test(promptText);
      s.gate = null;

      if (isReject) {
        s.phase = 'plan';
        addHandoff('you', activeModel, 'Revise plan');
        addLog(`${userName} requested plan revision: ${clip(summary, 60)}`, at);
        setAgentActivity(activeModel, 'working', `Discussing plan revision with ${userName}`, at, true);
      } else {
        s.phase = wasGate === 1 ? 'code' : inferPhaseFromPrompt(promptText);
        addHandoff('you', activeModel, wasGate ? 'approve' : 'prompt');
        addLog(`${userName}: ${clip(summary, 70)}`, at);
        setAgentActivity(activeModel, 'working', 'Analyzing request...', at, true);
      }
      join(activeModel);
    } else if (e.type === 'PLANNER_RESPONSE') {
      const tcs = Array.isArray(e.tool_calls) ? e.tool_calls : [];
      if (tcs.length > 0) {
        let genericTexts = '';
        for (let j = i + 1; j < steps.length && steps[j].type === 'GENERIC'; j++) {
          genericTexts += '\n' + String(steps[j].content || '');
        }
        const mBranch = genericTexts.match(/^\*\s+([A-Za-z0-9._/-]+)\s*$/m);
        if (mBranch && s.task) s.task.branch = mBranch[1];

        for (const tc of tcs) {
          if (!s.task || s.task.project === 'workspace' || s.task.project === 'logs' || s.task.project === defaultProject) {
            const pathArg = tc.args?.Path || tc.args?.FilePath || tc.args?.TargetFile || tc.args?.AbsolutePath || '';
            const detected = pathArg ? extractProjectFromPath(String(unquote(pathArg))) : null;
            if (detected && detected !== 'logs' && /^[A-Za-z0-9._-]+$/.test(detected) && s.task) {
              s.task.project = detected;
            }
          }

          if (tc.name === 'run_command') {
            const rawCmd = String(unquote(tc.args?.CommandLine) || '');
            if (/office-state\.mjs/.test(rawCmd)) {
              const mT = [...rawCmd.matchAll(/task\s+([^\s]+)\s+["']([^"']+)["']\s+([^\s]+)\s+([^\s]+)/g)].pop();
              if (mT) {
                s.task = { id: mT[1], title: mT[2], project: mT[3], branch: mT[4] };
              }
              const mH = [...rawCmd.matchAll(/handoff\s+([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_-]+)\s+["']?([^"']+)["']?/g)].pop();
              if (mH) addHandoff(canonAgent(mH[1]), canonAgent(mH[2]), mH[3]);
              const mA = [...rawCmd.matchAll(/agent\s+([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_-]+)\s+["']?([^"']*)["']?/g)].pop();
              if (mA) {
                const targetAgent = canonAgent(mA[1], activeModel);
                const msgText = clip(mA[3] || '', 60);
                setAgentActivity(targetAgent, mA[2], msgText, at, mA[2] !== 'idle' && Boolean(msgText));
              }
              const mP = [...rawCmd.matchAll(/phase\s+([a-zA-Z0-9_-]+)/g)].pop();
              if (mP) s.phase = mP[1];
              const mG = [...rawCmd.matchAll(/gate\s+([123]|none)\s*(?:["']?([^"']*)["']?)?/g)].pop();
              if (mG) {
                if (mG[1] === 'none') {
                  s.gate = null;
                } else {
                  s.gate = { n: Number(mG[1]), question: clip(mG[2] || `Awaiting ${userName}'s decision`, 90) };
                }
              }
              continue;
            }
          }

          if (tc.name === 'invoke_subagent') {
            const subModelArg = unquote(tc.args?.Model);
            const targetSubModel = subModelArg && subModelArg !== 'inherit' ? canonAgent(subModelArg, activeModel) : activeModel;
            if (targetSubModel !== activeModel) {
              addHandoff(activeModel, targetSubModel, 'delegate');
              activeModel = targetSubModel;
              s.activeAgent = activeModel;
              join(activeModel);
            }
          }

          const act = inferToolAction(tc, genericTexts, activeModel, s.phase);
          if (!act) continue;

          join(activeModel);
          s.phase = act.phase;
          if (act.gate !== undefined) s.gate = act.gate;
          if (act.propHandoff) addHandoff(act.propHandoff[0], act.propHandoff[1], act.propHandoff[2]);
          setAgentActivity(activeModel, act.status || 'working', act.message, at, true);
        }
      } else if (typeof e.content === 'string' && e.content.trim()) {
        const txt = e.content.trim();
        const asksApproval = /\b(approve|setuju|proceed|revisi)\b[\s\S]{0,120}\?/i.test(txt);
        if (asksApproval || s.gate) {
          if (!s.gate) {
            const gNum = (s.phase === 'docs' || s.phase === 'gate2' || /gate\s*2/i.test(txt)) ? 2 : (s.phase === 'release' || /gate\s*3/i.test(txt)) ? 3 : 1;
            if (gNum === 1) s.phase = 'gate1';
            else if (gNum === 2) s.phase = 'gate2';
            else if (gNum === 3) s.phase = 'release';
            s.gate = { n: gNum, question: clip(summarizeForChat(txt, 'assistant'), 90) };
          }
          setAgentActivity(activeModel, 'waiting', `Awaiting ${userName}'s decision`, at, true);
          addHandoff(activeModel, 'you', 'review');
        } else if (!steps.slice(i + 1).some(x => x.type === 'PLANNER_RESPONSE' || (x.type === 'USER_INPUT' && x.source === 'USER_EXPLICIT'))) {
          s.turn.done = true;
          s.phase = 'done';
          s.turn.participants.forEach(r => {
            const c = canonAgent(r);
            if (s.agents[c]?.status !== 'blocked') s.agents[c] = { status: 'done', message: 'Done' };
          });
          addHandoff(activeModel, 'you', 'response');
        }
      }
    }
  }

  const lastIsRunning = lastStep.type === 'USER_INPUT' || lastStep.type === 'GENERIC' ||
    (lastStep.type === 'PLANNER_RESPONSE' && Array.isArray(lastStep.tool_calls) && lastStep.tool_calls.length > 0);
  if (lastIsRunning) {
    s.turn.done = false;
    if (s.phase === 'done') s.phase = 'code';
    if (!['blocked', 'waiting'].includes(s.agents[activeModel]?.status)) {
      const curMsg = s.agents[activeModel]?.message;
      const fromLog = latestLoggedAction(activeModel);
      const isGeneric = !curMsg || curMsg === 'Done' || curMsg === 'Working...' || /^Executing:\s/i.test(curMsg);
      const safeMsg = !isGeneric ? curMsg : (fromLog || 'Analyzing request...');
      s.agents[activeModel] = { status: 'working', message: safeMsg };
    }
    for (const r of MODEL_AGENTS) {
      if (r !== activeModel && s.agents[r]?.status === 'done') {
        s.agents[r] = { status: 'idle', message: '' };
      }
    }
  }

  s.activeAgent = activeModel;
  s.models = getModelsStatus(activeModel);
  s.transcriptSync = { convId, stepCount: steps.length, cursor, syncedAt: new Date().toISOString() };
  s.updatedAt = new Date().toISOString();
  writeJsonSafe(targetStateFile, s);
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
      .map(m => ({ ...m, md: m.md || rawForChat(m.text), text: m.text || '' }));
  } catch {}

  const latestTranscript = findLatestAntigravityTranscript();
  const transcriptMsgs = latestTranscript ? parseTranscriptFile(latestTranscript, minTime, 'flash') : [];

  if (transcriptMsgs.length === 0) {
    const clean = fileMsgs.map((m, idx) => ({ ...m, n: idx + 1 }));
    return { seq: clean.length, messages: clean };
  }

  const merged = transcriptMsgs.map((m, idx) => ({ n: idx + 1, ...m }));
  return { seq: merged.length, messages: merged };
}

export function syncChatFileToDisk() {
  try {
    const data = buildMirroredChat();
    writeJsonSafe(chatFile, data);
    return data;
  } catch {
    return { seq: 0, messages: [] };
  }
}
