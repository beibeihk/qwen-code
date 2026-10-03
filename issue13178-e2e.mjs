/** Inspect the actual bundled CLI memory content sent to a local fake provider. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OVERLONG_INDEX, OVERLONG_MARKER, OVERLONG_ENTRY, OVERLONG_TARGET, RETAINED_ENTRY, SHORT_INDEX } from './issue13178-fixture.mjs';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) options[args[i].replace(/^--/, '')] = args[i + 1];
assert(['before', 'after'].includes(options.expect), '--expect before|after is required');
assert(options.bundle, '--bundle is required');
const bundlePath = resolve(options.bundle);
const bundleSha256 = createHash('sha256').update(await readFile(bundlePath)).digest('hex');
const scriptDir = dirname(fileURLToPath(import.meta.url));
const fixtureKind = options.fixture ?? 'overlong';
assert(['overlong', 'short'].includes(fixtureKind), '--fixture overlong|short');
const name = `${options.expect}-${fixtureKind}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const evidenceDir = resolve(options.evidence ?? join(scriptDir, 'evidence', name));
const isolatedHome = join(evidenceDir, 'home');
const qwenConfig = join(isolatedHome, '.qwen');
const runtimeDir = join(evidenceDir, 'runtime');
const memoryBase = join(evidenceDir, 'memory-store');
const userMemory = join(memoryBase, 'memories');
const fixtureWorkspace = join(evidenceDir, 'workspace');
for (const folder of [qwenConfig, runtimeDir, userMemory, fixtureWorkspace]) await mkdir(folder, { recursive: true });
const fixtureIndex = fixtureKind === 'overlong' ? OVERLONG_INDEX : SHORT_INDEX;
await writeFile(join(userMemory, 'MEMORY.md'), fixtureIndex + '\n');
await writeFile(join(userMemory, 'retained.md'), '---\nname: Synthetic retained note\ndescription: Local test fixture only\ntype: reference\n---\nA synthetic short note.\n');
const systemSettings = join(evidenceDir, 'system-settings.json');
const systemDefaults = join(evidenceDir, 'system-defaults.json');
await writeFile(systemSettings, '{}\n');
await writeFile(systemDefaults, '{}\n');
const MODEL = 'issue13178-local-mock';
const USER_PROMPT = 'issue13178_probe: Confirm the memory index is loaded. Reply only MEMORY_PROBE_OK without using tools.';
const requests = [];
const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.writeHead(404).end('local mock only'); return;
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  requests.push({ index: requests.length, url: req.url, body });
  const id = `chatcmpl-${randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const usage = { prompt_tokens: 20_000, completion_tokens: 4, total_tokens: 20_004 };
  const content = 'MEMORY_PROBE_OK';
  if (body.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const chunk = (delta, finish_reason = null) => ({
      id, object: 'chat.completion.chunk', created, model: MODEL,
      choices: [{ index: 0, delta, finish_reason }],
    });
    const send = (value) => res.write(`data: ${JSON.stringify(value)}\n\n`);
    send(chunk({ role: 'assistant' })); send(chunk({ content }));
    send({ ...chunk({}, 'stop'), usage }); res.end('data: [DONE]\n\n');
  } else {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id, object: 'chat.completion', created, model: MODEL,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage,
    }));
  }
});
await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
const settings = {
  model: { name: MODEL },
  modelProviders: { openai: [{
    id: MODEL, name: 'Issue 13178 local mock', baseUrl, envKey: 'OPENAI_API_KEY',
    generationConfig: { contextWindowSize: 200_000, timeout: 20_000, maxRetries: 0 },
  }] },
  security: { auth: { selectedType: 'openai' } },
  memory: { enableManagedAutoMemory: true, enableManagedAutoDream: false, enableTeamMemory: false, enableStructuredRecall: false },
  ui: { enableFollowupSuggestions: false }, telemetry: { enabled: false },
};
await writeFile(join(qwenConfig, 'settings.json'), JSON.stringify(settings, null, 2) + '\n');
const childEnv = {};
for (const [key, value] of Object.entries(process.env)) {
  if (/^(path|pathext|systemroot|windir|comspec|temp|tmp)$/i.test(key)) childEnv[key] = value;
}
Object.assign(childEnv, {
  HOME: isolatedHome, USERPROFILE: isolatedHome,
  APPDATA: join(isolatedHome, 'AppData', 'Roaming'), LOCALAPPDATA: join(isolatedHome, 'AppData', 'Local'),
  QWEN_HOME: qwenConfig, QWEN_RUNTIME_DIR: runtimeDir, QWEN_CODE_MEMORY_BASE_DIR: memoryBase,
  QWEN_CODE_SYSTEM_SETTINGS_PATH: systemSettings, QWEN_CODE_SYSTEM_DEFAULTS_PATH: systemDefaults,
  QWEN_CODE_MODELS_DEV: 'off', QWEN_CODE_MODELS_DEV_REFRESH: 'off',
  QWEN_CODE_MEMORY_STRUCTURED_RECALL: '0', QWEN_CODE_MEMORY_TEAM: '0', QWEN_CODE_MEMORY_TEAM_SYNC: '0',
  QWEN_SANDBOX: 'false', OPENAI_API_KEY: 'fake-local-only', OPENAI_BASE_URL: baseUrl,
  OPENAI_MODEL: MODEL, QWEN_MODEL: MODEL, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost',
});
const cliArgs = [bundlePath, '--auth-type', 'openai', '--model', MODEL,
  '--openai-base-url', baseUrl, '--openai-api-key', 'fake-local-only',
  '--output-format', 'stream-json', '-p', USER_PROMPT];
let stdout = '';
let stderr = '';
let timedOut = false;
const child = spawn(process.execPath, cliArgs, { cwd: fixtureWorkspace, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
child.stdout.on('data', (chunk) => { stdout += chunk; if (options.live === 'true') process.stdout.write(chunk); });
child.stderr.on('data', (chunk) => { stderr += chunk; if (options.live === 'true') process.stderr.write(chunk); });
const timer = setTimeout(() => { timedOut = true; child.kill(); }, 45_000);
let exit;
try {
  exit = await new Promise((accept, reject) => { child.once('error', reject); child.once('exit', (code, signal) => accept({ code, signal })); });
} finally {
  clearTimeout(timer); server.closeAllConnections(); await new Promise((accept) => server.close(accept));
}
const contentText = (content) => typeof content === 'string' ? content : Array.isArray(content)
  ? content.map((part) => part.text ?? '').join('\n') : '';
const mainRequest = requests.find(({ body }) => body.model === MODEL && body.stream === true);
const requestText = (mainRequest?.body.messages ?? []).map((message) => contentText(message.content)).join('\n');
const systemPrompt = (mainRequest?.body.messages ?? [])
  .filter((message) => message.role === 'system')
  .map((message) => contentText(message.content)).join('\n');
const markerAt = systemPrompt.indexOf(`- [${OVERLONG_MARKER}`);
const newlineAfter = markerAt >= 0 ? systemPrompt.indexOf('\n', markerAt) : -1;
const loadedOverlongLine = markerAt < 0 ? '' : systemPrompt.slice(markerAt, newlineAfter < 0 ? undefined : newlineAfter);
const outputEvents = stdout.split('\n').flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
const result = outputEvents.find((event) => event.type === 'result');
const summary = {
  expect: options.expect, fixtureKind, bundlePath, bundleSha256, nodeVersion: process.version,
  fakeProviderOnly: true, syntheticMemoryOnly: true,
  fixtureFirstLineChars: fixtureIndex.split('\n')[0].length, fixtureTotalChars: fixtureIndex.length,
  first25000CharsContainNewline: fixtureIndex.slice(0, 25_000).includes('\n'),
  userMemoryIndex: join(userMemory, 'MEMORY.md'),
  actualRequestCount: requests.length, capturedMainRequest: !!mainRequest,
  capturedMainRequestIndex: mainRequest?.index, memoryHeaderInSystem: systemPrompt.includes('# auto memory'),
  loadedOverlongLineChars: loadedOverlongLine.length,
  loadedOverlongLineEndsWith: loadedOverlongLine.slice(-18),
  hasOverlongMarker: markerAt >= 0, hasCompleteOverlongTarget: systemPrompt.includes(OVERLONG_TARGET + ')'),
  hasRetainedEntry: systemPrompt.includes(RETAINED_ENTRY), hasTruncationWarning: systemPrompt.includes('WARNING: MEMORY.md'),
  cliResult: result, exit, timedOut, evidenceDir,
};
await Promise.all([
  writeFile(join(evidenceDir, 'requests.ndjson'), requests.map((record) => JSON.stringify(record)).join('\n') + '\n'),
  writeFile(join(evidenceDir, 'captured-prompt.txt'), requestText),
  writeFile(join(evidenceDir, 'captured-system-prompt.txt'), systemPrompt),
  writeFile(join(evidenceDir, 'stdout.ndjson'), stdout), writeFile(join(evidenceDir, 'stderr.txt'), stderr),
  writeFile(join(evidenceDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n'),
]);
console.log(JSON.stringify(summary, null, 2));
assert(!timedOut, 'CLI timeout; evidence retained');
assert.equal(exit.code, 0, 'CLI execution failed; evidence retained');
assert(mainRequest, 'No actual main request captured');
assert(summary.memoryHeaderInSystem, 'The actual system message must contain managed memory');
assert.equal(result?.is_error, false, 'CLI probe must complete successfully');
assert(result?.result?.includes('MEMORY_PROBE_OK'));
if (fixtureKind === 'short') {
  assert(summary.hasRetainedEntry, 'Short index should load intact');
  assert(!summary.hasTruncationWarning, 'Short index should not be warned as oversized');
} else if (options.expect === 'before') {
  assert.equal(loadedOverlongLine.length, 25_000, 'Baseline should show the actual mid-line cut');
  assert(loadedOverlongLine.endsWith('%'), 'Baseline should contain a partial percent-encoded target');
  assert(!summary.hasCompleteOverlongTarget, 'Baseline must lose the complete target');
  assert(!summary.hasRetainedEntry, 'Baseline must lose the later short entry');
  assert(summary.hasTruncationWarning);
} else {
  assert(!summary.hasOverlongMarker, 'Fixed reader should drop the oversized entry whole');
  assert(summary.hasRetainedEntry, 'Fixed reader should retain the later short entry');
  assert(summary.hasTruncationWarning);
}
