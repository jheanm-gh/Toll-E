import { parseAndValidate, saLocalDate, type Dataset } from '@toll-e/core';

import { env, supabaseHeaders } from '@/config/env';

export class RemoteDataError extends Error {
  override name = 'RemoteDataError';
}

const TIMEOUT_MS = 15_000;

/**
 * Fetch the published dataset from the backend's public RPC and validate it completely
 * before it is allowed to replace anything on the device.
 */
export async function fetchPublishedDataset(signal?: AbortSignal): Promise<Dataset> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) throw new RemoteDataError('Backend not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());
  try {
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/published_dataset`, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
      signal: controller.signal,
    });
    if (!res.ok) throw new RemoteDataError(`Server responded ${res.status}`);
    const json: unknown = await res.json();
    const { dataset, issues } = parseAndValidate(json, { today: saLocalDate() });
    const errors = issues.filter((i) => i.severity === 'error');
    if (!dataset || errors.length) {
      throw new RemoteDataError(`Rejected server data (${errors.length} validation errors)`);
    }
    return dataset;
  } catch (e) {
    if (e instanceof RemoteDataError) throw e;
    throw new RemoteDataError(controller.signal.aborted ? 'Request timed out' : 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}
