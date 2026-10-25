#!/usr/bin/env node
// Server lokal sederhana untuk visualizer + live mirroring transcript Antigravity (Main Agent & Subagent).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMirroredChat,
  syncChatFileToDisk,
  syncStateFromTranscript,
  resetVisualizer,
  saveUsageConfig,
  computeModelUsage,
  getUserName,
  setUserName,
} from './mirror-transcript.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4177);
const HEADERS = { 'Cache-Control': 'no-store' };

async function readBody(req) {
  let d = '';
  for await (const c of req) d += c;
  try { return JSON.parse(d || '{}'); } catch { return {}; }
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const method = req.method || 'GET';

  if (method === 'POST' && url === '/reset') {
    try {
      resetVisualizer();
      return send(res, 200, 'application/json', JSON.stringify({ ok: true }));
    } catch (e) {
      return send(res, 500, 'application/json', JSON.stringify({ error: String(e.message || e) }));
    }
  }

  if (method === 'POST' && url === '/user') {
    try {
      const body = await readBody(req);
      const name = setUserName(body.userName || body.name);
      return send(res, 200, 'application/json', JSON.stringify({ ok: true, userName: name }));
    } catch (e) {
      return send(res, 500, 'application/json', JSON.stringify({ error: String(e.message || e) }));
    }
  }

  if (method === 'POST' && url === '/usage') {
    try {
      const body = await readBody(req);
      saveUsageConfig(body);
      return send(res, 200, 'application/json', JSON.stringify({ ok: true }));
    } catch (e) {
      return send(res, 500, 'application/json', JSON.stringify({ error: String(e.message || e) }));
    }
  }

  if (url === '/usage.json') {
    try {
      const data = computeModelUsage();
      return send(res, 200, 'application/json', JSON.stringify(data));
    } catch {
      return send(res, 500, 'application/json', JSON.stringify({ models: [] }));
    }
  }

  if (url === '/' || url === '/index.html') {
    try { return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(path.join(root, 'visualizer', 'index.html'))); }
    catch { return send(res, 500, 'text/plain; charset=utf-8', 'visualizer/index.html tidak ditemukan'); }
  }
  if (url === '/state.json') {
    try { syncStateFromTranscript(); } catch {}
    const f = path.join(root, '.office', 'state.json');
    let state = {};
    if (fs.existsSync(f)) {
      try { state = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
    } else {
      state = { empty: true };
    }
    state.userName = getUserName();
    try { state.models = computeModelUsage(); } catch {}
    return send(res, 200, 'application/json', JSON.stringify(state));
  }
  if (url === '/chat.json') {
    const data = buildMirroredChat();
    syncChatFileToDisk();
    return send(res, 200, 'application/json', JSON.stringify(data));
  }
  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
});

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, ...HEADERS });
  res.end(body);
}

// Sinkronisasi berkala di background supaya state.json selalu up-to-date
setInterval(() => {
  try { syncStateFromTranscript(); } catch {}
}, 1000).unref();

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Visualizer: http://localhost:${PORT}`);
  console.log('Membaca .office/state.json, .office/chat.json, dan live transcript Antigravity dari semua project. Tekan Ctrl+C untuk berhenti.');
});
