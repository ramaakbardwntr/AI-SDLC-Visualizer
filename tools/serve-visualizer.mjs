#!/usr/bin/env node
// Local server for visualizer + live Antigravity transcript mirroring (Main Agent & Subagents).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  syncChatFileToDisk,
  syncStateFromTranscript,
  resetVisualizer,
  getModelsStatus,
  getUserName,
  setUserName,
} from './mirror-transcript.mjs';

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), '..');
const PORT = Number(process.env.PORT || 4177);
const HEADERS = { 'Cache-Control': 'no-store' };

async function readBody(req) {
  let d = '';
  for await (const c of req) d += c;
  try { return JSON.parse(d || '{}'); } catch { return {}; }
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, ...HEADERS });
  res.end(body);
}

export async function handleVisualizerRequest(req, res) {
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

  if (url === '/' || url === '/index.html') {
    try {
      return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(path.join(root, 'visualizer', 'index.html')));
    } catch {
      return send(res, 500, 'text/plain; charset=utf-8', 'visualizer/index.html not found');
    }
  }

  if (url === '/favicon.ico') {
    res.writeHead(204, HEADERS);
    return res.end();
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
    try { state.models = getModelsStatus(state.activeAgent); } catch {}
    return send(res, 200, 'application/json', JSON.stringify(state));
  }

  if (url === '/chat.json') {
    const data = syncChatFileToDisk();
    return send(res, 200, 'application/json', JSON.stringify(data));
  }

  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFile)) {
  const server = http.createServer(handleVisualizerRequest);
  const serverV6 = http.createServer(handleVisualizerRequest);
  serverV6.on('error', () => {});

  setInterval(() => {
    try { syncStateFromTranscript(); } catch {}
  }, 1000).unref();

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Another serve-visualizer instance may already be running at http://localhost:${PORT}`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, '127.0.0.1', () => {
    try { serverV6.listen(PORT, '::1'); } catch {}
    console.log(`Visualizer: http://localhost:${PORT}`);
    console.log('Serving visualizer/index.html, .office/state.json, .office/chat.json, and live Antigravity transcripts. Press Ctrl+C to stop.');
  });
}
