import { writeFileSync } from 'node:fs';

import { format, resolveConfig } from 'prettier';

/** Write a data file in the repository's Prettier style, so script edits leave a clean diff. */
export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  const options = (await resolveConfig(path)) ?? {};
  writeFileSync(path, await format(JSON.stringify(value, null, 2), { ...options, filepath: path }));
}
