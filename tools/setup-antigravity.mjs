#!/usr/bin/env node
// Memasang hook Antigravity untuk visualizer: menulis .agents/hooks.json (path absolut, sesuai folder ini).
// Jalankan sekali: node tools/setup-antigravity.mjs   (ulangi bila folder kantor dipindah)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'tools', 'office-hook.mjs').replace(/\\/g, '/');
const cmd = ev => `node ${script} --source antigravity --event ${ev}`;
const flat = ev => [{ type: 'command', command: cmd(ev), timeout: 15 }];

const group = {
  PostToolUse: [{ matcher: '.*', hooks: flat('PostToolUse') }],  // bersarang: matcher regex + hooks
  PreInvocation: flat('PreInvocation'),                          // datar
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
  console.log('Tertulis: ' + file);
}
console.log('Cek di Antigravity: menu ... > Customizations > Hooks (IDE), atau /hooks (CLI).');
