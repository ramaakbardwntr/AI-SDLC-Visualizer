import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonAgent,
  matchModelName,
  modelIdFromName,
  inferToolAction,
  inferPhaseFromPrompt,
  getModelsStatus,
  rawForChat,
  parseTranscriptFile,
  syncStateFromTranscript,
  MODEL_AGENTS,
  MODEL_NAMES,
} from './mirror-transcript.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { handleVisualizerRequest } from './serve-visualizer.mjs';

describe('4 AI Model Canonical Mapping', () => {
  test('MODEL_AGENTS contains exactly the 4 target AI model IDs', () => {
    assert.deepEqual(MODEL_AGENTS, ['argon', 'flash', 'opus', 'sonnet']);
    assert.deepEqual(MODEL_NAMES, [
      'Gemini 4 Argon',
      'Gemini 3.8 Flash',
      'Claude Opus 5.5',
      'Claude Sonnet 5.5'
    ]);
  });

  test('canonAgent maps slugs and display names correctly', () => {
    assert.equal(canonAgent('argon'), 'argon');
    assert.equal(canonAgent('gemini-4-argon'), 'argon');
    assert.equal(canonAgent('Gemini 4 Argon'), 'argon');

    assert.equal(canonAgent('flash'), 'flash');
    assert.equal(canonAgent('gemini-3.8-flash'), 'flash');
    assert.equal(canonAgent('gemini-3-8-flash'), 'flash');
    assert.equal(canonAgent('Gemini 3.8 Flash'), 'flash');
    assert.equal(canonAgent('flash_lite'), 'flash');

    assert.equal(canonAgent('opus'), 'opus');
    assert.equal(canonAgent('claude-opus-5.5'), 'opus');
    assert.equal(canonAgent('Claude Opus 5.5'), 'opus');

    assert.equal(canonAgent('sonnet'), 'sonnet');
    assert.equal(canonAgent('claude-sonnet-5.5'), 'sonnet');
    assert.equal(canonAgent('Claude Sonnet 5.5'), 'sonnet');
  });

  test('canonAgent gracefully falls back for unknown or legacy roles', () => {
    assert.equal(canonAgent('developer', 'sonnet'), 'sonnet');
    assert.equal(canonAgent('architect', 'argon'), 'argon');
    assert.equal(canonAgent('qa', 'sonnet'), 'sonnet');
    assert.equal(canonAgent('unknown-role', 'flash'), 'flash');
  });

  test('getModelsStatus correctly lists all 4 models and toggles active status', () => {
    const status = getModelsStatus('argon');
    assert.equal(status.models.length, 4);
    assert.deepEqual(status.models.map(m => m.id), ['argon', 'flash', 'opus', 'sonnet']);
    assert.equal(status.models.find(m => m.id === 'argon')?.active, true);
    assert.equal(status.models.find(m => m.id === 'flash')?.active, false);

    const flashStatus = getModelsStatus('flash');
    assert.equal(flashStatus.models.find(m => m.id === 'flash')?.active, true);
    assert.equal(flashStatus.models.find(m => m.id === 'argon')?.active, false);
  });
});

describe('Requirement 2 Fix: Implementation Plan Action Bubbles', () => {
  test('edit_file on implementation_plan.md displays Editing and preserves current phase', () => {
    const act = inferToolAction(
      {
        name: 'edit_file',
        args: {
          Path: 'C:/Users/user/.gemini/antigravity/brain/conv123/implementation_plan.md',
          Target: '- [ ] Task',
          Replacement: '- [x] Task'
        }
      },
      '',
      'sonnet',
      'code'
    );

    assert.ok(act);
    assert.equal(act.role, 'sonnet');
    assert.equal(act.phase, 'code', 'Workflow phase must NOT regress back to plan on edit_file');
    assert.equal(act.message, 'Editing implementation_plan.md', 'Avatar bubble must say Editing, not Menyusun');
    assert.equal(act.status, undefined, 'Status should remain standard working unless feedback requested');
  });

  test('initial write_file on implementation_plan.md without feedback displays Drafting and sets plan phase', () => {
    const act = inferToolAction(
      {
        name: 'write_file',
        args: {
          Path: 'C:/Users/user/.gemini/antigravity/brain/conv123/implementation_plan.md',
          Content: '# Plan'
        }
      },
      '',
      'argon',
      'intake'
    );

    assert.ok(act);
    assert.equal(act.role, 'argon');
    assert.equal(act.phase, 'plan');
    assert.equal(act.message, 'Drafting implementation_plan.md');
  });

  test('write_file with RequestFeedback: true triggers gate1 and waiting status', () => {
    const act = inferToolAction(
      {
        name: 'write_file',
        args: {
          Path: 'C:/Users/user/.gemini/antigravity/brain/conv123/implementation_plan.md',
          ArtifactMetadata: { RequestFeedback: true }
        }
      },
      '',
      'argon',
      'plan'
    );

    assert.ok(act);
    assert.equal(act.role, 'argon');
    assert.equal(act.phase, 'gate1');
    assert.equal(act.status, 'waiting');
    assert.equal(act.message, 'Plan ready, awaiting approval');
    assert.deepEqual(act.propHandoff, ['argon', 'you', 'plan.md']);
    assert.equal(act.gate?.n, 1);
  });
});

describe('Centralized Model Tool Routing & External Props', () => {
  test('code edits route to active model with Editing message', () => {
    const act = inferToolAction(
      {
        name: 'edit_file',
        args: { Path: 'workspace/order-service/OrdersService.cs' }
      },
      '',
      'sonnet',
      'code'
    );

    assert.equal(act.role, 'sonnet');
    assert.equal(act.phase, 'code');
    assert.equal(act.message, 'Editing OrdersService.cs');
  });

  test('git operations route to active model and handoff to github prop', () => {
    const act = inferToolAction(
      {
        name: 'run_command',
        args: { CommandLine: 'git commit -m "feat: cancel order"' }
      },
      '',
      'sonnet',
      'code'
    );

    assert.equal(act.role, 'sonnet');
    assert.equal(act.phase, 'code');
    assert.deepEqual(act.propHandoff, ['sonnet', 'github', 'Commit']);
  });

  test('failing unit test sets blocked status and failure message', () => {
    const genericOutput = 'Test Run Failed.\nFailed CancelOrder_WhenPaid_ReturnsConflict\nFailed CancelOrder_UpdatesStatusColumn';
    const act = inferToolAction(
      {
        name: 'run_command',
        args: { CommandLine: 'dotnet test --filter OrderService' }
      },
      genericOutput,
      'sonnet',
      'test'
    );

    assert.equal(act.role, 'sonnet');
    assert.equal(act.phase, 'test');
    assert.equal(act.status, 'blocked');
    assert.match(act.message, /CancelOrder_WhenPaid_ReturnsConflict/);
    assert.deepEqual(act.propHandoff, ['sonnet', 'sonnet', 'test error']);
  });

  test('docmost publishing routes to active model and hands off to docmost prop', () => {
    const act = inferToolAction(
      {
        name: 'mcp__strand__update_page',
        args: { page_id: '123', content: '# Docs' }
      },
      '',
      'opus',
      'docs'
    );

    assert.equal(act.role, 'opus');
    assert.equal(act.phase, 'docs');
    assert.deepEqual(act.propHandoff, ['opus', 'docmost', 'Push Doc']);
  });

  test('jira drafting routes to active model and hands off to jira prop', () => {
    const act = inferToolAction(
      {
        name: 'write_file',
        args: { Path: '.office/tasks/task-1/jira.md' }
      },
      '',
      'sonnet',
      'release'
    );

    assert.equal(act.role, 'sonnet');
    assert.equal(act.phase, 'release');
    assert.deepEqual(act.propHandoff, ['sonnet', 'jira', 'Write Jira']);
  });

  test('pr.md drafting routes to active model and hands off to github prop', () => {
    const act = inferToolAction(
      {
        name: 'write_file',
        args: { Path: '.office/tasks/task-1/pr.md' }
      },
      '',
      'sonnet',
      'release'
    );

    assert.equal(act.role, 'sonnet');
    assert.equal(act.phase, 'release');
    assert.equal(act.message, 'Drafting PR description');
    assert.deepEqual(act.propHandoff, ['sonnet', 'github', 'Draft PR']);
  });
});

describe('Untruncated Conversation Chat & Full Transcript Resolution', () => {
  test('rawForChat preserves strings > 3,000 characters without truncation', () => {
    const longText = 'Line ' + 'X'.repeat(50) + '\n';
    const content = longText.repeat(80); // > 4000 chars
    assert.ok(content.length > 3000);
    const result = rawForChat(content);
    assert.equal(result.length, content.trim().length);
    assert.ok(!result.endsWith('…'));
  });

  test('parseTranscriptFile resolves full content from transcript_full.jsonl when truncated_fields includes content', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-test-'));
    const logsDir = path.join(tmpDir, '.system_generated', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });

    const compactPath = path.join(logsDir, 'transcript.jsonl');
    const fullPath = path.join(logsDir, 'transcript_full.jsonl');

    const step0 = {
      step_index: 0,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      content: 'Hello, please run test suite',
      created_at: new Date().toISOString()
    };
    const longFullContent = 'Detailed planner response with deep technical analysis.\n' + 'Analysis line\n'.repeat(50);
    const step1Compact = {
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      content: 'Detailed planner response with deep...',
      truncated_fields: ['content'],
      created_at: new Date().toISOString()
    };
    const step1Full = {
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      content: longFullContent,
      created_at: step1Compact.created_at
    };

    fs.writeFileSync(compactPath, JSON.stringify(step0) + '\n' + JSON.stringify(step1Compact) + '\n');
    fs.writeFileSync(fullPath, JSON.stringify(step0) + '\n' + JSON.stringify(step1Full) + '\n');

    const msgs = parseTranscriptFile(compactPath, 0, 'flash');
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, 'user');
    assert.equal(msgs[1].role, 'assistant');
    assert.equal(msgs[1].text, longFullContent.trim());
    assert.equal(msgs[1].md, longFullContent.trim());

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('Visualizer HTTP Server Routes', () => {
  test('GET /, /index.html, /state.json, /chat.json, and /favicon.ico respond accurately', async () => {
    const srv = http.createServer(handleVisualizerRequest);
    await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
    const { port } = srv.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const rootRes = await fetch(`${baseUrl}/`);
      assert.equal(rootRes.status, 200);
      assert.match(rootRes.headers.get('content-type') || '', /text\/html/);
      const html = await rootRes.text();
      assert.match(html, /<!doctype html>/i);
      assert.match(html, /<canvas id="c"/);

      const idxRes = await fetch(`${baseUrl}/index.html`);
      assert.equal(idxRes.status, 200);

      const favRes = await fetch(`${baseUrl}/favicon.ico`);
      assert.equal(favRes.status, 204);

      const stateRes = await fetch(`${baseUrl}/state.json`);
      assert.equal(stateRes.status, 200);
      const stateJson = await stateRes.json();
      assert.ok(Array.isArray(stateJson.models?.models));
      assert.equal(stateJson.models.models.length, 4);

      const chatRes = await fetch(`${baseUrl}/chat.json`);
      assert.equal(chatRes.status, 200);
      const chatJson = await chatRes.json();
      assert.ok(Array.isArray(chatJson.messages));

      const notFoundRes = await fetch(`${baseUrl}/does-not-exist`);
      assert.equal(notFoundRes.status, 404);
    } finally {
      await new Promise(resolve => srv.close(resolve));
    }
  });
});

describe('Avatar Bubble <-> Activity 1:1 Parity & Project Guard', () => {
  test('trailing GENERIC step recovers exact Activity action instead of Working...', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubble-parity-'));
    const convDir = path.join(tmpDir, 'conv-parity-01', '.system_generated', 'logs');
    fs.mkdirSync(convDir, { recursive: true });
    const transcriptPath = path.join(convDir, 'transcript.jsonl');
    const stateFilePath = path.join(tmpDir, 'state.json');

    try {
      const steps = [
        { step_index: 0, source: 'USER_EXPLICIT', type: 'USER_INPUT', content: 'Model Selection` from Gemini 3.8 Flash to Gemini 4 Argon. No need\n<USER_REQUEST>\nAssess visualizer bubble\n</USER_REQUEST>', created_at: '2026-10-28T16:40:00Z' },
        { step_index: 1, source: 'MODEL', type: 'PLANNER_RESPONSE', content: '', tool_calls: [{ name: 'read_file', args: { Path: '.agents/skills/implementation-plan/SKILL.md' } }], created_at: '2026-10-28T16:40:01Z' },
      ];
      fs.writeFileSync(transcriptPath, steps.map(x => JSON.stringify(x)).join('\n') + '\n');

      const s1 = syncStateFromTranscript({ transcriptPath, stateFilePath });
      assert.equal(s1.activeAgent, 'argon');
      assert.equal(s1.agents.argon.status, 'working');
      assert.equal(s1.agents.argon.message, 'Reading SKILL.md');
      assert.equal(s1.log[s1.log.length - 1].text, 'Gemini 4 Argon: Reading SKILL.md');

      // Simulate stale 'Done' overwrite before GENERIC tool output arrives
      const corrupted = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
      corrupted.agents.argon = { status: 'done', message: 'Done' };
      fs.writeFileSync(stateFilePath, JSON.stringify(corrupted, null, 2));

      steps.push({ step_index: 2, source: 'SYSTEM', type: 'GENERIC', status: 'DONE', content: 'File contents...', created_at: '2026-10-28T16:40:02Z' });
      fs.writeFileSync(transcriptPath, steps.map(x => JSON.stringify(x)).join('\n') + '\n');

      const s2 = syncStateFromTranscript({ transcriptPath, stateFilePath });
      assert.equal(s2.agents.argon.status, 'working');
      assert.equal(s2.agents.argon.message, 'Reading SKILL.md', 'Must mirror latest Activity log, never Working...');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('IGNORE_TOOLS after real tool preserves previous Activity action on avatar bubble', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubble-ignore-'));
    const convDir = path.join(tmpDir, 'conv-parity-02', '.system_generated', 'logs');
    fs.mkdirSync(convDir, { recursive: true });
    const transcriptPath = path.join(convDir, 'transcript.jsonl');
    const stateFilePath = path.join(tmpDir, 'state.json');

    try {
      const steps = [
        { step_index: 0, source: 'USER_EXPLICIT', type: 'USER_INPUT', content: 'Update index.html', created_at: '2026-10-28T16:41:00Z' },
        {
          step_index: 1,
          source: 'MODEL',
          type: 'PLANNER_RESPONSE',
          content: '',
          tool_calls: [
            { name: 'edit_file', args: { Path: 'visualizer/index.html' } },
            { name: 'manage_task', args: { Action: 'list' } }
          ],
          created_at: '2026-10-28T16:41:01Z'
        },
      ];
      fs.writeFileSync(transcriptPath, steps.map(x => JSON.stringify(x)).join('\n') + '\n');

      const s = syncStateFromTranscript({ transcriptPath, stateFilePath });
      const active = s.activeAgent;
      assert.equal(s.agents[active].message, 'Editing index.html');
      assert.ok(s.log.some(l => l.text.endsWith(': Editing index.html')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('run_command with slashes does not corrupt task.project and matches Activity', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubble-cmd-'));
    const convDir = path.join(tmpDir, 'conv-parity-03', '.system_generated', 'logs');
    fs.mkdirSync(convDir, { recursive: true });
    const transcriptPath = path.join(convDir, 'transcript.jsonl');
    const stateFilePath = path.join(tmpDir, 'state.json');

    try {
      const steps = [
        { step_index: 0, source: 'USER_EXPLICIT', type: 'USER_INPUT', content: 'Check diff', created_at: '2026-10-28T16:42:00Z' },
        {
          step_index: 1,
          source: 'MODEL',
          type: 'PLANNER_RESPONSE',
          content: '',
          tool_calls: [
            { name: 'run_command', args: { CommandLine: 'git diff tools/serve-visualizer.mjs', toolSummary: 'Check git diff on serve-visualizer.mjs' } }
          ],
          created_at: '2026-10-28T16:42:01Z'
        },
      ];
      fs.writeFileSync(transcriptPath, steps.map(x => JSON.stringify(x)).join('\n') + '\n');

      const s = syncStateFromTranscript({ transcriptPath, stateFilePath });
      assert.equal(s.task.project, 'ai-engineering-office', 'CommandLine must never corrupt task.project');
      const active = s.activeAgent;
      assert.equal(s.agents[active].message, 'Check git diff on serve-visualizer.mjs');
      assert.ok(s.log.some(l => l.text.endsWith(': Check git diff on serve-visualizer.mjs')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});




