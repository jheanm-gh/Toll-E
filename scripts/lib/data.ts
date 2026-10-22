import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseTariffCsv,
  saLocalDate,
  type Dataset,
  type RowError,
  type Tariff,
} from '../../packages/core/src/index.ts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = join(ROOT, 'data');

const readJson = <T>(name: string): T => JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8')) as T;

export interface LoadedData {
  dataset: Dataset;
  csvErrors: { file: string; errors: RowError[] }[];
}

/** Assemble the canonical dataset from the files in data/. */
export function loadDataset(): LoadedData {
  const meta = readJson<{ datasetVersion: string; country: 'ZA' }>('meta.json');
  const tariffs: Tariff[] = [];
  const csvErrors: LoadedData['csvErrors'] = [];
  const tariffDir = join(DATA_DIR, 'tariffs');
  for (const file of readdirSync(tariffDir)
    .filter((f) => f.endsWith('.csv'))
    .sort()) {
    const { tariffs: rows, errors } = parseTariffCsv(readFileSync(join(tariffDir, file), 'utf8'));
    tariffs.push(...rows);
    if (errors.length) csvErrors.push({ file: `data/tariffs/${file}`, errors });
  }
  const dataset: Dataset = {
    schemaVersion: 1,
    datasetVersion: meta.datasetVersion,
    generatedAt: new Date().toISOString(),
    country: meta.country,
    sources: readJson('sources.json'),
    operators: readJson('operators.json'),
    tollRoads: readJson('toll-roads.json'),
    vehicleClassSchemes: readJson('vehicle-classes.json'),
    plazas: readJson('plazas.json'),
    schedules: readJson('schedules.json'),
    tariffs,
    journeys: readJson('journeys.json'),
    notices: readJson('notices.json'),
  };
  return { dataset, csvErrors };
}

/** The subset consumers see: published records only. */
export function publishedSubset(dataset: Dataset): Dataset {
  const plazas = dataset.plazas.filter((p) => p.publicationStatus === 'published');
  const plazaIds = new Set(plazas.map((p) => p.id));
  return {
    ...dataset,
    plazas,
    tariffs: dataset.tariffs.filter((t) => t.publicationStatus === 'published' && plazaIds.has(t.plazaId)),
    journeys: dataset.journeys.filter((j) => j.publicationStatus === 'published'),
  };
}

export const today = () => process.env.TOLLE_TODAY ?? saLocalDate();
