const entry = (id, chars) => {
  const prefix = `- [${id}](${id.toLowerCase()}.md) — `;
  return { id, text: prefix + 'x'.repeat(chars - prefix.length) };
};

export const BOUNDARY_ENTRIES = [
  entry('LONG0', 12_480), entry('LONG1', 12_480),
  entry('ORDINARY', 150), entry('TAIL', 30),
];
export const LF_BOUNDARY_INDEX = BOUNDARY_ENTRIES.map(({ text }) => text).join('\n') + '\n';
export const CRLF_BOUNDARY_INDEX = BOUNDARY_ENTRIES.map(({ text }) => text).join('\r\n') + '\r\n';
