/** Record actual headless test process output with real elapsed times. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) options[args[i].replace(/^--/, '')] = args[i + 1];
assert(['before', 'after'].includes(options.expect), '--expect before|after is required');
assert(options.bundle, '--bundle is required');
const scriptDir = dirname(fileURLToPath(import.meta.url));
const harnessPath = join(scriptDir, 'issue13178-e2e.mjs');
const name = `${options.expect}-${options.fixture ?? 'overlong'}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const castPath = resolve(options.cast ?? join(scriptDir, 'recordings', `${name}.cast`));
await mkdir(dirname(castPath), { recursive: true });
const commandArgs = [harnessPath, '--bundle', resolve(options.bundle), '--expect', options.expect, '--live', 'true'];
if (options.fixture) commandArgs.push('--fixture', options.fixture);
const displayArg = (value) => /\s/.test(value) ? `"${value}"` : value;
const command = [process.execPath, ...commandArgs].map(displayArg).join(' ');
const startedAt = new Date();
const startNs = process.hrtime.bigint();
const elapsed = () => Number(process.hrtime.bigint() - startNs) / 1e9;
const header = {
  version: 2, width: 140, height: 45, timestamp: Math.floor(startedAt.getTime() / 1000),
  title: `Qwen Code issue #13178 ${options.expect}: deterministic headless CLI`,
  env: { TERM: 'xterm-256color' },
  command,
};
const events = [];
const chunks = [];
const emit = (data, channel = 'recorder') => {
  const t = elapsed();
  const terminalData = data.replace(/(?<!\r)\n/g, '\r\n');
  events.push([t, 'o', terminalData]);
  chunks.push({ elapsedSeconds: t, channel, data });
  process.stdout.write(data);
};
emit(`$ ${command}\n`);
const child = spawn(process.execPath, commandArgs, {
  cwd: scriptDir, windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (chunk) => emit(chunk, 'stdout'));
child.stderr.on('data', (chunk) => emit(chunk, 'stderr'));
let exit;
try {
  exit = await new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => accept({ code, signal }));
  });
  emit(`\n[recorder] exit code=${exit.code}, signal=${exit.signal ?? 'none'}, elapsed=${elapsed().toFixed(3)}s\n`);
} finally {
  const ndjson = (values) => values.map((value) => JSON.stringify(value)).join('\n') + '\n';
  await Promise.all([
    writeFile(castPath, JSON.stringify(header) + '\n' + ndjson(events)),
    writeFile(`${castPath}.chunks.ndjson`, ndjson(chunks)),
    writeFile(`${castPath}.meta.json`, JSON.stringify({
      command, nodeBinary: process.execPath, args: commandArgs,
      cwd: scriptDir, startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(), elapsedSeconds: elapsed(),
      exit, castPath,
      recordingType: 'actual headless stdout/stderr chunks; not interactive TUI capture',
      timingSource: 'process.hrtime.bigint monotonic elapsed time',
      syntheticOutput: 'Only recorder command and exit-status labels; all child output is captured verbatim.',
    }, null, 2) + '\n'),
  ]);
}
console.log(`[recorder] saved ${castPath}`);
process.exitCode = exit?.code ?? 1;
