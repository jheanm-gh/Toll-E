import { appVersion, backendConfigured, env, supabaseHeaders } from '@/config/env';
import { getClientId } from '@/state/storage';

export type CorrectionCategory = 'tariff' | 'location' | 'plaza_details' | 'payment' | 'journey' | 'other';

export interface CorrectionInput {
  category: CorrectionCategory;
  message: string;
  plazaId?: string;
  contactEmail?: string;
  datasetVersion: string;
}

export type CorrectionChannel = 'backend' | 'email' | 'none';

/** How reports can be sent in this build. */
export const correctionChannel: CorrectionChannel = backendConfigured ? 'backend' : env.supportEmail ? 'email' : 'none';

export type SubmitResult = { ok: true } | { ok: false; message: string };

export async function submitCorrection(input: CorrectionInput): Promise<SubmitResult> {
  if (correctionChannel !== 'backend' || !env.supabaseUrl || !env.supabaseAnonKey) {
    return { ok: false, message: 'Reporting is not available in this build.' };
  }
  try {
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/submit_correction`, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_client_id: await getClientId(),
        p_category: input.category,
        p_message: input.message,
        p_plaza_id: input.plazaId ?? null,
        p_contact_email: input.contactEmail?.trim() || null,
        p_app_version: appVersion,
        p_dataset_version: input.datasetVersion,
      }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429 || res.status === 400) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, message: body?.message ?? 'The report could not be accepted.' };
    }
    return { ok: false, message: `The server could not accept the report (${res.status}). Please try again later.` };
  } catch {
    return { ok: false, message: 'No connection. Your report was not sent — please try again when you are online.' };
  }
}

export function correctionMailto(input: CorrectionInput): string | null {
  if (!env.supportEmail) return null;
  const subject = `Toll-E correction: ${input.category}${input.plazaId ? ` (${input.plazaId})` : ''}`;
  const body = `${input.message}\n\n— Dataset ${input.datasetVersion}, app ${appVersion}`;
  return `mailto:${env.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
