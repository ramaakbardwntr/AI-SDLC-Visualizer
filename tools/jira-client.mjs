#!/usr/bin/env node
// Jira Cloud CLI client for AI Engineering Office.
// Reads credentials directly from .mcp.json (zero external dependencies, Node 18+).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mcpFile = path.join(root, '.mcp.json');

// KLG Jira Custom Field IDs
export const JIRA_CUSTOM_FIELDS = {
  APPLICATION_GLOBAL: 'customfield_12291',    // Select
  TRIBE_GLOBAL: 'customfield_12290',          // Select
  SDLC_EVIDENCES: 'customfield_12370',        // Cascading select (parent + child)
  BUSINESS_UNIT_GLOBAL: 'customfield_12289',  // Multi-select (array)
  TEAM: 'customfield_10001'                   // Atlassian Team
};

function loadConfig() {
  if (!fs.existsSync(mcpFile)) {
    throw new Error(`MCP config file not found at ${mcpFile}. Please copy .mcp.json.example to .mcp.json.`);
  }

  const mcp = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
  const jira = mcp.mcpServers?.jira;
  if (!jira) {
    throw new Error('Jira configuration missing in .mcp.json under mcpServers.jira.');
  }

  const baseUrl = (jira.serverUrl || jira.baseUrl || 'https://klgtech.atlassian.net').replace(/\/+$/, '');
  let authHeader = jira.headers?.Authorization;

  // Resolve Basic auth if email + apiToken provided or header is Basic
  if (authHeader && authHeader.startsWith('Basic ')) {
    // Already basic
  } else if (jira.email && jira.apiToken) {
    const cred = Buffer.from(`${jira.email}:${jira.apiToken}`).toString('base64');
    authHeader = `Basic ${cred}`;
  } else if (authHeader && authHeader.startsWith('Bearer ATATT3')) {
    if (jira.email) {
      const token = authHeader.replace(/^Bearer\s+/, '');
      const cred = Buffer.from(`${jira.email}:${token}`).toString('base64');
      authHeader = `Basic ${cred}`;
    } else {
      throw new Error('Atlassian API token requires an email for Basic authentication. Add "email": "user@domain.com" in .mcp.json.');
    }
  }

  if (!authHeader) {
    throw new Error('Authorization header or (email + apiToken) missing in .mcp.json for jira.');
  }

  return { baseUrl, authHeader, email: jira.email };
}

async function request(endpoint, options = {}) {
  const { baseUrl, authHeader } = loadConfig();
  const url = `${baseUrl}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch {}
    const msg = parsed?.errorMessages?.join('; ') ||
                (parsed?.errors ? JSON.stringify(parsed.errors) : text) ||
                res.statusText;
    throw new Error(`Jira API HTTP ${res.status} on ${endpoint}: ${msg}`);
  }

  return res.json();
}

function textToAdf(text) {
  if (!text) return undefined;
  const blocks = text.split(/\r?\n\r?\n/).filter(b => b.trim().length > 0);
  if (blocks.length === 0) return undefined;

  const content = blocks.map(block => {
    const lines = block.split(/\r?\n/);
    const inlineContent = [];
    lines.forEach((line, idx) => {
      if (line) {
        inlineContent.push({ type: 'text', text: line });
      }
      if (idx < lines.length - 1) {
        inlineContent.push({ type: 'hardBreak' });
      }
    });
    return {
      type: 'paragraph',
      content: inlineContent.length > 0 ? inlineContent : [{ type: 'text', text: ' ' }]
    };
  });

  return {
    type: 'doc',
    version: 1,
    content
  };
}

function triggerVisualizerHandoff() {
  try {
    const script = path.join(root, 'tools', 'office-state.mjs');
    if (fs.existsSync(script)) {
      execSync(`node "${script}" handoff sonnet jira "Write Jira"`, { stdio: 'ignore' });
    }
  } catch {}
}

// Commands
async function cmdWhoami() {
  const user = await request('/rest/api/3/myself');
  console.log(`Authenticated Jira User:`);
  console.log(`  Name      : ${user.displayName}`);
  console.log(`  Email     : ${user.emailAddress || '(hidden)'}`);
  console.log(`  Account ID: ${user.accountId}`);
  console.log(`  Timezone  : ${user.timeZone}`);
}

async function cmdProjects() {
  const projects = await request('/rest/api/3/project');
  console.log(`Available Jira Projects (${projects.length}):`);
  projects.forEach(p => {
    console.log(`  [${p.key.padEnd(8)}] ${p.name}`);
  });
}

async function cmdOptions(projectKey = 'BOWP', issueTypeId = '10044') {
  console.log(`Fetching createmeta options for Project: ${projectKey}, IssueType: ${issueTypeId}...`);
  const meta = await request(`/rest/api/3/issue/createmeta/${projectKey}/issuetypes/${issueTypeId}`);
  const fields = meta.values || meta.fields || [];

  const targets = [
    { key: JIRA_CUSTOM_FIELDS.APPLICATION_GLOBAL, label: 'Application (Global)' },
    { key: JIRA_CUSTOM_FIELDS.TRIBE_GLOBAL, label: 'Tribe/Department (Global)' },
    { key: JIRA_CUSTOM_FIELDS.SDLC_EVIDENCES, label: 'SDLC Evidences (Parent & Child)' },
    { key: JIRA_CUSTOM_FIELDS.BUSINESS_UNIT_GLOBAL, label: 'Business Unit (Global) [Multiple]' },
  ];

  targets.forEach(t => {
    const f = fields.find(item => item.fieldId === t.key);
    console.log(`\n======================================================`);
    console.log(`📌 ${t.label} [${t.key}]`);
    if (!f || !f.allowedValues) {
      console.log(`  (No allowed values returned by createmeta)`);
      return;
    }
    if (t.key === JIRA_CUSTOM_FIELDS.SDLC_EVIDENCES) {
      f.allowedValues.forEach(parent => {
        console.log(`  Parent: [${parent.id}] ${parent.value}`);
        (parent.children || []).forEach(child => {
          console.log(`    Child: [${child.id}] ${child.value}`);
        });
      });
    } else {
      f.allowedValues.forEach(val => {
        console.log(`  - [${val.id}] ${val.value}`);
      });
    }
  });
}

async function cmdSearch(jql, limit = 10) {
  const res = await request(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=summary,status,issuetype,priority,created,updated,parent`);
  const issues = res.issues || [];
  console.log(`Found ${issues.length} issues:`);
  issues.forEach((iss, i) => {
    const type = iss.fields.issuetype?.name || 'Task';
    const status = iss.fields.status?.name || 'Unknown';
    const parent = iss.fields.parent?.key ? ` (Parent: ${iss.fields.parent.key})` : '';
    console.log(`  ${(i + 1).toString().padStart(2)}. [${iss.key}] [${type}] [${status}] ${iss.fields.summary}${parent}`);
  });
}

async function cmdListDone(limit = 10) {
  const user = await request('/rest/api/3/myself');
  const jql = `assignee = "${user.accountId}" AND statusCategory = Done ORDER BY updated DESC`;
  await cmdSearch(jql, limit);
}

async function cmdCreate(opts) {
  const {
    project,
    type = 'Task',
    summary,
    description,
    parent,
    application = 'Superapps',
    tribe = 'Back Office & E-Commerce',
    sdlc = 'Development Iteration:develop',
    bu = 'FBI'
  } = opts;

  if (!project || !summary) {
    throw new Error('Arguments --project <KEY> and --summary "<title>" are required.');
  }

  const fields = {
    project: { key: project.toUpperCase() },
    summary,
    issuetype: { name: type }
  };

  if (description) {
    fields.description = textToAdf(description);
  }

  if (parent) {
    fields.parent = { key: parent };
  }

  // 1. Application (Global)
  if (application) {
    fields[JIRA_CUSTOM_FIELDS.APPLICATION_GLOBAL] = { value: application };
  }

  // 2. Tribe/Department (Global)
  if (tribe) {
    fields[JIRA_CUSTOM_FIELDS.TRIBE_GLOBAL] = { value: tribe };
  }

  // 3. SDLC Evidences (Parent:Child)
  if (sdlc) {
    const parts = sdlc.split(':').map(s => s.trim());
    if (parts.length === 2) {
      fields[JIRA_CUSTOM_FIELDS.SDLC_EVIDENCES] = {
        value: parts[0],
        child: { value: parts[1] }
      };
    } else {
      fields[JIRA_CUSTOM_FIELDS.SDLC_EVIDENCES] = { value: parts[0] };
    }
  }

  // 4. Business Unit (Global) - can be multiple comma-separated
  if (bu) {
    const bus = bu.split(',').map(s => s.trim()).filter(Boolean);
    fields[JIRA_CUSTOM_FIELDS.BUSINESS_UNIT_GLOBAL] = bus.map(b => ({ value: b }));
  }

  triggerVisualizerHandoff();

  const res = await request('/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify({ fields })
  });

  const { baseUrl } = loadConfig();
  const issueUrl = `${baseUrl}/browse/${res.key}`;
  console.log(`Issue created successfully:`);
  console.log(`  Key         : ${res.key}`);
  console.log(`  URL         : ${issueUrl}`);
  console.log(`  Type        : ${type}`);
  console.log(`  Application : ${application || '-'}`);
  console.log(`  Tribe       : ${tribe || '-'}`);
  console.log(`  SDLC        : ${sdlc || '-'}`);
  console.log(`  BusinessUnit: ${bu || '-'}`);
  return { key: res.key, url: issueUrl };
}

// Simple CLI arg parser
function parseArgs(args) {
  const result = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    } else {
      result._.push(arg);
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  try {
    switch (command) {
      case 'whoami':
        await cmdWhoami();
        break;
      case 'projects':
        await cmdProjects();
        break;
      case 'options':
        await cmdOptions(args.project || 'BOWP', args.typeId || '10044');
        break;
      case 'search':
        if (!args._[1]) throw new Error('JQL query required: node tools/jira-client.mjs search "<JQL>" [--limit N]');
        await cmdSearch(args._[1], parseInt(args.limit || '10', 10));
        break;
      case 'list-done':
        await cmdListDone(parseInt(args.limit || '10', 10));
        break;
      case 'create':
        await cmdCreate({
          project: args.project,
          type: args.type || 'Task',
          summary: args.summary,
          description: args.desc || args.description,
          parent: args.parent,
          application: args.app || args.application,
          tribe: args.tribe,
          sdlc: args.sdlc,
          bu: args.bu || args.businessUnit
        });
        break;
      default:
        console.log(`Jira Cloud CLI Client for AI Engineering Office`);
        console.log(`Usage:`);
        console.log(`  node tools/jira-client.mjs whoami`);
        console.log(`  node tools/jira-client.mjs projects`);
        console.log(`  node tools/jira-client.mjs options [--project <KEY>]`);
        console.log(`  node tools/jira-client.mjs search "<JQL>" [--limit N]`);
        console.log(`  node tools/jira-client.mjs list-done [--limit N]`);
        console.log(`  node tools/jira-client.mjs create --project <KEY> --type <Epic|Story|Task|sub-task> --summary "<title>" [--desc "<desc>"] [--parent <KEY>] [--app "<app>"] [--tribe "<tribe>"] [--sdlc "<parent:child>"] [--bu "<bu1,bu2>"]`);
        break;
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
