/**
 * Minimal Supabase client mock for unit tests.
 * Prevents createClient() from throwing during service construction.
 * Does NOT simulate any DB behavior.
 */
import { vi } from 'vitest';

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    rpc: async () => ({ data: null, error: null }),
  }),
}));
