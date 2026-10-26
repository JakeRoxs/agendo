import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentPrompt, createSessionBridge } from '../agent-requests.mjs';

describe('buildAgentPrompt', () => {
  const makeTodos = (n) => Array.from({ length: n }, (_, i) => ({
    id: `sq-${String(i + 1).padStart(3, '0')}`,
    title: `Todo ${i + 1}`,
    status: 'pending',
    priority: 'p2',
    group: 'security',
    description: `Description for todo ${i + 1}`,
    scannerEvidence: `Evidence for ${i + 1}`,
    resumeContext: null,
    criteria: [{ met: false, text: `Criterion ${i + 1}` }],
    dependencies: [],
    validation: []
  }));

  it('throws on invalid intent', () => {
    assert.throws(
      () => buildAgentPrompt({ intent: 'implement', todos: makeTodos(1), selection: {} }),
      { code: 'invalid_input', message: 'Unknown request intent' }
    );
  });

  it('throws on empty todos', () => {
    assert.throws(
      () => buildAgentPrompt({ intent: 'explain', todos: [], selection: {} }),
      { code: 'invalid_input', message: 'No todos match this selection' }
    );
  });

  it('throws on missing todos', () => {
    assert.throws(
      () => buildAgentPrompt({ intent: 'explain', todos: undefined, selection: {} }),
      { code: 'invalid_input' }
    );
  });

  it('includes read-only constraints in header', () => {
    const prompt = buildAgentPrompt({ intent: 'explain', todos: makeTodos(1), selection: {} });
    assert.match(prompt, /read-only/);
    assert.match(prompt, /not authorization to implement/);
    assert.match(prompt, /untrusted data/);
    assert.match(prompt, /Do not invoke explain_finding recursively/);
    assert.match(prompt, /Evidence packet \(TOON\)/);
  });

  it('uses correct intent text', () => {
    const explain = buildAgentPrompt({ intent: 'explain', todos: makeTodos(1), selection: {} });
    assert.match(explain, /Explain the selected finding/);

    const investigate = buildAgentPrompt({ intent: 'investigate', todos: makeTodos(1), selection: {} });
    assert.match(investigate, /Investigate the selected evidence/);

    const suggest = buildAgentPrompt({ intent: 'suggest-fix', todos: makeTodos(1), selection: {} });
    assert.match(suggest, /Suggest a fix plan/);
    assert.match(suggest, /Do not implement the plan/);

    const verify = buildAgentPrompt({ intent: 'verify', todos: makeTodos(1), selection: {} });
    assert.match(verify, /assess the acceptance criteria/);
    assert.match(verify, /Do not claim verification without evidence/);
  });

  it('includes todo identifiers and fields in TOON', () => {
    const todos = [{
      id: 'sq-123',
      title: 'SQL injection risk',
      status: 'pending',
      priority: 'p1',
      group: 'security',
      description: 'Test description',
      scannerEvidence: 'Test evidence',
      resumeContext: 'Resume here',
      criteria: [{ met: true, text: 'Met criterion' }, { met: false, text: 'Unmet criterion' }],
      dependencies: ['sq-456'],
      validation: ['Test validation']
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.match(prompt, /sq-123/);
    assert.match(prompt, /SQL injection risk/);
    assert.match(prompt, /status: pending/);
    assert.match(prompt, /priority: p1/);
    assert.match(prompt, /security/);
    assert.match(prompt, /Test description/);
    assert.match(prompt, /Test evidence/);
    assert.match(prompt, /Resume here/);
    assert.match(prompt, /Met criterion/);
    assert.match(prompt, /Unmet criterion/);
    assert.match(prompt, /sq-456/);
    assert.match(prompt, /Test validation/);
  });

  it('redacts private keys', () => {
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
      scannerEvidence: null, resumeContext: null, criteria: [], dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(!prompt.includes('MIIEpAIBAAKCAQEA'));
    assert.match(prompt, /\[REDACTED PRIVATE KEY\]/);
  });

  it('redacts GitHub tokens', () => {
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: 'Use token ghp_ABCDEF1234567890abcdef to authenticate',
      scannerEvidence: null, resumeContext: null, criteria: [], dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(!prompt.includes('ghp_ABCDEF1234567890abcdef'));
    assert.match(prompt, /\[REDACTED TOKEN\]/);
  });

  it('redacts OpenAI-style keys', () => {
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: 'API key: sk-abcdefghijklmnopqrstuvwxyz123456',
      scannerEvidence: null, resumeContext: null, criteria: [], dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(!prompt.includes('sk-abcdefghijklmnopqrstuvwxyz123456'));
    assert.match(prompt, /\[REDACTED TOKEN\]/);
  });

  it('redacts password fields', () => {
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: 'password: secret123\napi_key: myapikey456',
      scannerEvidence: null, resumeContext: null, criteria: [], dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(!prompt.includes('secret123'));
    assert.ok(!prompt.includes('myapikey456'));
    assert.ok(prompt.includes('[REDACTED]'));
  });

  it('redacts authorization headers', () => {
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: 'Authorization: Bearer my-bearer-token-xyz',
      scannerEvidence: null, resumeContext: null, criteria: [], dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(!prompt.includes('my-bearer-token-xyz'));
    assert.match(prompt, /Authorization: Bearer \[REDACTED\]/i);
  });

  it('redacts URL credentials', () => {
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: 'Visit https://user:pass123@example.com/api',
      scannerEvidence: null, resumeContext: null, criteria: [], dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(!prompt.includes('user:pass123@'));
    assert.match(prompt, /https:\/\/\[REDACTED\]@example\.com/);
  });

  it('truncates long titles to 200 chars', () => {
    const longTitle = 'T'.repeat(500);
    const todos = [{
      id: 'sq-001', title: longTitle, status: 'pending', priority: 'p2',
      description: '', scannerEvidence: null, resumeContext: null, criteria: [], dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(!prompt.includes(longTitle), 'Long title should be truncated');
    assert.match(prompt, /\[truncated\]/);
    const titleLine = prompt.split('\n').find(l => l.includes('title:'));
    assert.ok(titleLine, 'Should have title field');
    assert.ok(titleLine.length < 500, 'Title line should be much shorter than original');
  });

  it('truncates long descriptions to 1000 chars', () => {
    const longDesc = 'D'.repeat(2000);
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: longDesc, scannerEvidence: null, resumeContext: null, criteria: [], dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(!prompt.includes(longDesc), 'Long description should be truncated');
    assert.match(prompt, /\[truncated\]/);
  });

  it('truncates long scanner evidence to 2000 chars', () => {
    const longEvidence = 'E'.repeat(5000);
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: '', scannerEvidence: longEvidence, resumeContext: null, criteria: [], dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(!prompt.includes(longEvidence), 'Long evidence should be truncated');
    assert.match(prompt, /\[truncated\]/);
  });

  it('limits included todos to 8', () => {
    const todos = makeTodos(15);
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.match(prompt, /included: 8/);
    assert.match(prompt, /omitted: 7/);
    assert.match(prompt, /matched: 15/);
    for (let i = 9; i <= 15; i++) {
      assert.ok(!prompt.includes(`sq-${String(i).padStart(3, '0')}`), `Todo ${i} should not be included`);
    }
  });

  it('counts included plus omitted equals total', () => {
    const todos = makeTodos(5);
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.match(prompt, /included: 5/);
    assert.match(prompt, /omitted: 0/);
    assert.match(prompt, /matched: 5/);
  });

  it('limits criteria to 10', () => {
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: '', scannerEvidence: null, resumeContext: null,
      criteria: Array.from({ length: 15 }, (_, i) => ({ met: false, text: `Criterion ${i}` })),
      dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.match(prompt, /criteria\[10\]/);
    assert.ok(!prompt.includes('Criterion 10'), 'Only first 10 criteria should be included');
    assert.ok(!prompt.includes('Criterion 14'), 'Only first 10 criteria should be included');
  });

  it('limits dependencies to 15', () => {
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: '', scannerEvidence: null, resumeContext: null, criteria: [],
      dependencies: Array.from({ length: 20 }, (_, i) => `dep-${i}`),
      validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.match(prompt, /dependencies\[15\]/);
    assert.ok(!prompt.includes('dep-15'), 'Only first 15 dependencies should be included');
  });

  it('limits validation items to 5', () => {
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: '', scannerEvidence: null, resumeContext: null, criteria: [],
      dependencies: [],
      validation: Array.from({ length: 10 }, (_, i) => `Validation ${i}`)
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.match(prompt, /validation\[5\]/);
    assert.ok(!prompt.includes('Validation 5'), 'Only first 5 validation items should be included');
  });

  it('stays within MAX_PROMPT bound', () => {
    const todos = makeTodos(100);
    todos.forEach(t => {
      t.description = 'X'.repeat(1500);
      t.scannerEvidence = 'Y'.repeat(2500);
    });
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(prompt.length <= 18050, `Prompt too long: ${prompt.length}`);
  });

  it('includes selection filter group info', () => {
    const prompt = buildAgentPrompt({
      intent: 'explain',
      todos: makeTodos(1),
      selection: {
        view: { kind: 'group', groupName: 'security' },
        filters: { status: 'pending', priority: 'p1', group: 'security' }
      }
    });
    assert.match(prompt, /kind: group/);
    assert.match(prompt, /groupName: security/);
    assert.match(prompt, /status: pending/);
    assert.match(prompt, /priority: p1/);
    assert.match(prompt, /group: security/);
  });

  it('handles null selection fields', () => {
    const prompt = buildAgentPrompt({
      intent: 'explain',
      todos: makeTodos(1),
      selection: null
    });
    assert.ok(prompt.length > 0);
  });

  it('truncates criterion text to 160 chars', () => {
    const todos = [{
      id: 'sq-001', title: 'Test', status: 'pending', priority: 'p2',
      description: '', scannerEvidence: null, resumeContext: null,
      criteria: [{ met: false, text: 'C'.repeat(300) }],
      dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.match(prompt, /\[truncated\]/);
  });

  it('handles special characters in TOON encoding', () => {
    const todos = [{
      id: 'sq-001', title: 'Test with "quotes" and \\backslash', status: 'pending', priority: 'p2',
      description: 'Line one\nLine two\tTabbed', scannerEvidence: null, resumeContext: null, criteria: [], dependencies: [], validation: []
    }];
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(prompt.includes('sq-001'));
    assert.match(prompt, /Evidence packet \(TOON\)/);
    assert.ok(prompt.includes('description: "Line one\\nLine two\\tTabbed"'));
    assert.ok(prompt.includes('title: "Test with \\"quotes\\" and \\\\backslash"'));
  });

  it('preserves string IDs and escapes TOON controls without JSON-only escapes', () => {
    const todos = makeTodos(1);
    todos[0].id = '001';
    todos[0].description = '\b\f\0\\b';
    const prompt = buildAgentPrompt({ intent: 'verify', todos, selection: { view: { kind: 'group', groupName: 'true' } } });
    assert.ok(prompt.includes('id: "001"'));
    assert.ok(prompt.includes('groupName: "true"'));
    assert.ok(prompt.includes('description: "\\u0008\\u000c\\u0000\\\\b"'));
    assert.ok(prompt.includes('criteria[1]{met,text}:'));
  });

  it('omits todos when prompt would exceed MAX_PROMPT', () => {
    const todos = makeTodos(50);
    todos.forEach(t => {
      t.description = 'X'.repeat(1000);
      t.scannerEvidence = 'Y'.repeat(2000);
      t.resumeContext = 'Z'.repeat(500);
      t.criteria = Array.from({ length: 10 }, (_, i) => ({ met: false, text: 'C'.repeat(160) }));
    });
    const prompt = buildAgentPrompt({ intent: 'explain', todos, selection: {} });
    assert.ok(prompt.length <= 18050);
    const includedMatch = prompt.match(/included: (\d+)/);
    const omittedMatch = prompt.match(/omitted: (\d+)/);
    assert.ok(parseInt(includedMatch[1]) < 50, 'Should omit some todos to stay within limit');
    assert.ok(parseInt(omittedMatch[1]) > 0, 'Should report omitted todos');
    assert.equal(parseInt(includedMatch[1]) + parseInt(omittedMatch[1]), 50, 'Included + omitted should equal total');
  });
});

describe('createSessionBridge', () => {
  function createMockSession() {
    const listeners = [];
    return {
      send: mock.fn(async (options) => 'msg-123'),
      on: mock.fn((listener) => {
        listeners.push(listener);
        return () => {
          const idx = listeners.indexOf(listener);
          if (idx >= 0) listeners.splice(idx, 1);
        };
      }),
      _emit: (event) => {
        for (const l of listeners) l(event);
      },
      _listeners: listeners
    };
  }

  it('reports unsupported when getSession returns null', () => {
    const bridge = createSessionBridge(() => null);
    assert.equal(bridge.getState().supported, false);
    bridge.dispose();
  });

  it('reports unsupported for session missing send', () => {
    const bridge = createSessionBridge(() => ({ on: () => () => {} }));
    assert.equal(bridge.getState().supported, false);
    bridge.dispose();
  });

  it('reports unsupported for session missing on', () => {
    const bridge = createSessionBridge(() => ({ send: () => {} }));
    assert.equal(bridge.getState().supported, false);
    bridge.dispose();
  });

  it('reports supported for valid session', () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    assert.equal(bridge.getState().supported, true);
    bridge.dispose();
  });

  it('send fails on unsupported host', async () => {
    const bridge = createSessionBridge(() => null);
    const result = await bridge.send({ prompt: 'Test' });
    assert.equal(result.success, false);
    assert.equal(result.reason, 'unsupported');
    bridge.dispose();
  });

  it('uses enqueue mode when sending', async () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    await bridge.send({ prompt: 'Test prompt' });
    assert.equal(session.send.mock.calls.length, 1);
    const callArgs = session.send.mock.calls[0].arguments[0];
    assert.equal(callArgs.prompt, 'Test prompt');
    assert.equal(callArgs.mode, 'enqueue');
    bridge.dispose();
  });

  it('returns accepted result on successful send', async () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    const result = await bridge.send({ prompt: 'Test' });
    assert.equal(result.success, true);
    assert.equal(result.reason, 'accepted');
    assert.equal(result.messageId, 'msg-123');
    bridge.dispose();
  });

  it('rejects in-flight duplicate send', async () => {
    const session = createMockSession();
    let resolveSend;
    session.send.mock.mockImplementation(() => new Promise(r => { resolveSend = r; }));
    const bridge = createSessionBridge(() => session);
    const first = bridge.send({ prompt: 'First' });
    const second = await bridge.send({ prompt: 'Second' });
    assert.equal(second.success, false);
    assert.equal(second.reason, 'busy');
    resolveSend('msg-456');
    await first;
    bridge.dispose();
  });

  it('rejects send when session is busy', async () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    bridge.getState();
    session._emit({ type: 'assistant.turn_start' });
    const result = await bridge.send({ prompt: 'Test' });
    assert.equal(result.success, false);
    assert.equal(result.reason, 'busy');
    bridge.dispose();
  });

  it('allows send after idle', async () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    bridge.getState();
    session._emit({ type: 'assistant.turn_start' });
    session._emit({ type: 'session.idle' });
    const result = await bridge.send({ prompt: 'Test' });
    assert.equal(result.success, true);
    bridge.dispose();
  });

  it('recovers from send failure and allows retry', async () => {
    const session = createMockSession();
    let callCount = 0;
    session.send.mock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('Network error'));
      return Promise.resolve('msg-retry');
    });
    const bridge = createSessionBridge(() => session);
    const first = await bridge.send({ prompt: 'Test' });
    assert.equal(first.success, false);
    assert.equal(first.reason, 'send_failed');
    session._emit({ type: 'session.idle' });
    const second = await bridge.send({ prompt: 'Test' });
    assert.equal(second.success, true);
    bridge.dispose();
  });

  it('ignores events from subagents', () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    bridge.getState();
    session._emit({ type: 'assistant.turn_start', agentId: 'sub-1' });
    assert.equal(bridge.getState().status, 'unknown');
    session._emit({ type: 'assistant.turn_start', data: { agentId: 'sub-2' } });
    assert.equal(bridge.getState().status, 'unknown');
    bridge.dispose();
  });

  it('tracks busy status from main session events', () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    bridge.getState();
    session._emit({ type: 'assistant.turn_start' });
    assert.equal(bridge.getState().status, 'busy');
    bridge.dispose();
  });

  it('tracks idle status', () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    bridge.getState();
    session._emit({ type: 'assistant.turn_start' });
    session._emit({ type: 'session.idle' });
    assert.equal(bridge.getState().status, 'idle');
    bridge.dispose();
  });

  it('tracks failed status', () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    bridge.getState();
    session._emit({ type: 'session.error' });
    assert.equal(bridge.getState().status, 'failed');
    bridge.dispose();
  });

  it('tracks closed status', () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    bridge.getState();
    session._emit({ type: 'session.shutdown' });
    assert.equal(bridge.getState().status, 'closed');
    bridge.dispose();
  });

  it('dispose unsubscribes and closes', () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session);
    bridge.getState();
    bridge.dispose();
    assert.equal(session._listeners.length, 0);
    assert.equal(bridge.getState().status, 'closed');
    assert.equal(bridge.getState().supported, false);
  });

  it('replaces session and cleans up old listener', () => {
    const session1 = createMockSession();
    const session2 = createMockSession();
    let current = session1;
    const bridge = createSessionBridge(() => current);
    bridge.getState();
    assert.equal(session1.on.mock.calls.length, 1);
    current = session2;
    bridge.getState();
    assert.equal(session2.on.mock.calls.length, 1);
    assert.equal(session1._listeners.length, 0);
    assert.equal(session2._listeners.length, 1);
    bridge.dispose();
  });

  it('shows sending status during in-flight request', async () => {
    const session = createMockSession();
    let resolveSend;
    session.send.mock.mockImplementation(() => new Promise(r => { resolveSend = r; }));
    const bridge = createSessionBridge(() => session);
    const sendPromise = bridge.send({ prompt: 'Test' });
    assert.equal(bridge.getState().status, 'sending');
    resolveSend('msg-789');
    await sendPromise;
    bridge.dispose();
  });

  it('send returns queued status while in flight', async () => {
    const session = createMockSession();
    let resolveSend;
    session.send.mock.mockImplementation(() => new Promise(r => { resolveSend = r; }));
    const bridge = createSessionBridge(() => session);
    const sendPromise = bridge.send({ prompt: 'Test' });
    assert.equal(bridge.getState().status, 'sending');
    resolveSend('msg-789');
    await sendPromise;
    bridge.dispose();
  });

  it('detects disconnected state when session is lost', () => {
    const session = createMockSession();
    let current = session;
    const bridge = createSessionBridge(() => current, { reconnectInterval: 100 });
    bridge.getState();
    assert.equal(bridge.getState().supported, true);
    current = null;
    assert.equal(bridge.getState().supported, false);
    assert.equal(bridge.getState().status, 'disconnected');
    bridge.dispose();
  });

  it('reconnects when session is restored', () => {
    const session1 = createMockSession();
    const session2 = createMockSession();
    let current = session1;
    const bridge = createSessionBridge(() => current, { reconnectInterval: 100 });
    bridge.getState();
    assert.equal(session1.on.mock.calls.length, 1);
    // Simulate disconnect
    current = null;
    assert.equal(bridge.getState().status, 'disconnected');
    // Simulate reconnect with new session
    current = session2;
    // Force attach by calling getState
    bridge.getState();
    assert.equal(session2.on.mock.calls.length, 1);
    assert.equal(session1._listeners.length, 0);
    assert.equal(session2._listeners.length, 1);
    assert.equal(bridge.getState().supported, true);
    bridge.dispose();
  });

  it('detects no-response when admitted request receives no host events', async () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session, { noResponseTimeout: 50 });
    bridge.getState();
    const result = await bridge.send({ prompt: 'Test' });
    assert.equal(result.success, true);
    // Immediately after admit, status is queued
    assert.equal(bridge.getState().status, 'queued');
    // Wait for no-response timeout
    await new Promise(r => setTimeout(r, 100));
    assert.equal(bridge.getState().status, 'no-response');
    bridge.dispose();
  });

  it('acknowledgeNoResponse clears the queued latch', async () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session, { noResponseTimeout: 50 });
    bridge.getState();
    await bridge.send({ prompt: 'Test' });
    assert.equal(bridge.getState().status, 'queued');
    bridge.acknowledgeNoResponse();
    assert.notEqual(bridge.getState().status, 'queued');
    // Now send should work again
    const result = await bridge.send({ prompt: 'Test 2' });
    assert.equal(result.success, true);
    bridge.dispose();
  });

  it('rejects send while in no-response state', async () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session, { noResponseTimeout: 50 });
    bridge.getState();
    await bridge.send({ prompt: 'Test' });
    await new Promise(r => setTimeout(r, 100));
    assert.equal(bridge.getState().status, 'no-response');
    const result = await bridge.send({ prompt: 'Test 2' });
    assert.equal(result.success, false);
    assert.equal(result.reason, 'busy');
    bridge.dispose();
  });

  it('dispose stops reconnect and clears no-response timer', async () => {
    const session = createMockSession();
    let current = session;
    const bridge = createSessionBridge(() => current, { reconnectInterval: 50, noResponseTimeout: 50 });
    bridge.getState();
    await bridge.send({ prompt: 'Test' });
    bridge.dispose();
    assert.equal(bridge.getState().status, 'closed');
    // No further status changes after dispose
    await new Promise(r => setTimeout(r, 100));
    assert.equal(bridge.getState().status, 'closed');
    assert.equal(session._listeners.length, 0);
  });

  it('host event clears queued state before no-response timeout', async () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session, { noResponseTimeout: 200 });
    bridge.getState();
    await bridge.send({ prompt: 'Test' });
    assert.equal(bridge.getState().status, 'queued');
    // Host responds before timeout
    session._emit({ type: 'assistant.turn_start' });
    assert.equal(bridge.getState().status, 'busy');
    // No no-response after timeout
    await new Promise(r => setTimeout(r, 100));
    assert.notEqual(bridge.getState().status, 'no-response');
    bridge.dispose();
  });

  it('does not infer completion from no host events', async () => {
    const session = createMockSession();
    const bridge = createSessionBridge(() => session, { noResponseTimeout: 50 });
    bridge.getState();
    await bridge.send({ prompt: 'Test' });
    await new Promise(r => setTimeout(r, 100));
    // Should be no-response, not idle (which would imply completion)
    assert.equal(bridge.getState().status, 'no-response');
    bridge.dispose();
  });

  it('multiple instances share single bridge correctly', () => {
    const session = createMockSession();
    let instanceCount = 0;
    const bridge = createSessionBridge(() => session);
    // Simulate multiple canvas instances polling
    for (let i = 0; i < 5; i++) {
      const state = bridge.getState();
      assert.equal(state.supported, true);
      instanceCount++;
    }
    assert.equal(session.on.mock.calls.length, 1, 'Should only subscribe once regardless of instance count');
    assert.equal(instanceCount, 5);
    bridge.dispose();
  });
});
