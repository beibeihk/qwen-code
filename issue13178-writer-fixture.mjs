import assert from 'node:assert/strict';
import path from 'node:path';

export const WRITER_NOTICE = '\n\n> WARNING: MEMORY.md is too large; only part of it was written. Keep index entries concise and move detail into topic files.';

// Documents only: no destination files or long directories are created.
export function makeWriterNoticeFixture(buildManagedAutoMemoryIndex) {
  const makePath = (label) => 'reference/' + [
    ...Array.from({ length: 14 }, (_, i) => `${label}${' '.repeat(253)}${i % 10}`),
    `${label}${' '.repeat(250)}b.md`,
  ].join('/');
  const longs = ['A', 'B', 'C'].map((label) => ({
    title: label.repeat(120), type: 'reference', description: `Long ${label}`,
    relativePath: makePath(label),
  }));
  const ordinary = Array.from({ length: 12 }, (_, i) => ({
    title: `Normal ${i}`, type: 'reference', description: 'h'.repeat(150),
    relativePath: `reference/normal-${i}.md`,
  }));
  for (const doc of longs) {
    assert(doc.relativePath.split('/').every((component) => Buffer.byteLength(component) <= 255));
    assert(Buffer.byteLength(path.posix.join('/tmp/qwen-memory', doc.relativePath)) < 4096);
  }
  const index = buildManagedAutoMemoryIndex([...longs, ...ordinary]);
  assert(index.endsWith(WRITER_NOTICE), 'Actual writer must append its exact known notice');
  const body = index.slice(0, -WRITER_NOTICE.length);
  const longEntries = longs.slice(0, 2).map((doc) => buildManagedAutoMemoryIndex([doc]));
  const ordinaryEntries = ordinary.map((doc) => buildManagedAutoMemoryIndex([doc]));
  assert(body.length <= 25_000);
  assert(index.length > 25_000);
  for (const line of [...longEntries, ...ordinaryEntries]) assert(body.includes(line));
  return {
    index, body, longEntries, ordinaryEntries,
    metadata: {
      generatedBy: 'public buildManagedAutoMemoryIndex from actual compiled core module',
      bodyChars: body.length, bodyLines: body.split('\n').length,
      noticeChars: WRITER_NOTICE.length, totalChars: index.length,
      admittedLongEntryChars: longEntries.map((line) => line.length),
      admittedOrdinaryEntryCount: ordinaryEntries.length,
      rawRelativePathBytes: longs.map((doc) => Buffer.byteLength(doc.relativePath)),
      maxComponentBytes: 255, longDestinationFilesCreated: false,
    },
  };
}
