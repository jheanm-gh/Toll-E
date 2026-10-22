/** Minimal RFC 4180 CSV reader/writer (quoted fields, escaped quotes, CRLF or LF). */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const input = text.replace(/^﻿/, '');
  while (i < input.length) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
      i++;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += ch === '\r' && input[i + 1] === '\n' ? 2 : 1;
    } else {
      field += ch;
      i++;
    }
  }
  if (quoted) throw new Error('CSV ends inside a quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Parse CSV with a header row into objects keyed by header name. Lines starting with # are comments. */
export function parseCsvRecords(text: string): { header: string[]; records: Record<string, string>[] } {
  const rows = parseCsv(text).filter((r) => !(r[0] ?? '').trimStart().startsWith('#'));
  const [header, ...body] = rows;
  if (!header) return { header: [], records: [] };
  const names = header.map((h) => h.trim());
  const records = body.map((r) => {
    const rec: Record<string, string> = {};
    names.forEach((n, i) => (rec[n] = (r[i] ?? '').trim()));
    return rec;
  });
  return { header: names, records };
}

function escapeField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((r) => r.map(escapeField).join(',')).join('\n') + '\n';
}
