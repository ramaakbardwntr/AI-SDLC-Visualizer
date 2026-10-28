#!/usr/bin/env node
// Install Antigravity lifecycle hooks for visualizer: writes .agents/hooks.json (absolute path).
// Run once: node tools/setup-antigravity.mjs   (re-run if the project directory is moved)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'tools', 'office-hook.mjs').replace(/\\/g, '/');
const cmd = ev => `node ${script} --source antigravity --event ${ev}`;
const flat = ev => [{ type: 'command', command: cmd(ev), timeout: 15 }];

const group = {
  PostToolUse: [{ matcher: '.*', hooks: flat('PostToolUse') }],  // nested: regex matcher + command hook
  PreInvocation: flat('PreInvocation'),                          // flat hook list
  PostInvocation: flat('PostInvocation'),
};

const targets = [
  path.join(root, '.agents', 'hooks.json'),
  path.join(os.homedir(), '.gemini', 'config', 'hooks.json'),
];

for (const file of targets) {
  let cur = {};
  try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  cur['ai-office-visualizer'] = group;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cur, null, 2));
  console.log('Installed hook config: ' + file);
}
console.log('Check in Antigravity: menu ... > Customizations > Hooks (IDE), or /hooks (CLI).');
