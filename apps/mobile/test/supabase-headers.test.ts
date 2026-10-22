import { env, supabaseHeaders } from '@/config/env';

const mutableEnv = env as { supabaseAnonKey: string | null };

describe('Supabase request headers', () => {
  const original = mutableEnv.supabaseAnonKey;
  afterEach(() => {
    mutableEnv.supabaseAnonKey = original;
  });

  it('sends a legacy anon key (a JWT) as apikey and bearer token', () => {
    mutableEnv.supabaseAnonKey = 'eyJhbGciOiJIUzI1NiJ9.e30.sig';
    expect(supabaseHeaders()).toEqual({
      apikey: 'eyJhbGciOiJIUzI1NiJ9.e30.sig',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig',
    });
  });

  it('sends a publishable key only as apikey, never as a bearer token', () => {
    mutableEnv.supabaseAnonKey = 'sb_publishable_abc123';
    expect(supabaseHeaders()).toEqual({ apikey: 'sb_publishable_abc123' });
  });
});
