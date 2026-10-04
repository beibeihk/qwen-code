import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const [lfPath, crlfPath, outputPath] = process.argv.slice(2);
assert(lfPath && crlfPath, 'Provide actual LF and CRLF summary.json paths');
const [lf, crlf] = await Promise.all([lfPath, crlfPath].map(async (path) => JSON.parse(await readFile(path, 'utf8'))));
assert.equal(lf.fixtureKind, 'lf-150');
assert.equal(crlf.fixtureKind, 'crlf-150');
assert.equal(lf.bundleSha256, crlf.bundleSha256);
assert.deepEqual(lf.sourceProvenanceBefore, crlf.sourceProvenanceBefore);
assert.deepEqual(lf.boundaryEntryIds, crlf.boundaryEntryIds, 'Actual LF/CRLF main system entry sets must match');
assert.deepEqual(lf.boundaryPartialEntryIds, []);
assert.deepEqual(crlf.boundaryPartialEntryIds, []);
const result = { lfSummary: lfPath, crlfSummary: crlfPath, bundleSha256: lf.bundleSha256,
  sourceProvenance: lf.sourceProvenanceBefore, actualMainEntryIds: lf.boundaryEntryIds, sameEntrySet: true };
if (outputPath) await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
