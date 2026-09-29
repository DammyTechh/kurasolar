import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Calls a Supabase Edge Function and turns error responses into readable
 * messages. Every privileged action (calculating, paying, downloading,
 * admin actions) goes through here; the browser never holds a secret.
 */
export async function invoke<T>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let message = 'Something went wrong. Please try again.';
      try {
        const payload = await error.context.json();
        if (payload?.error) message = payload.error;
      } catch {
        /* keep default */
      }
      throw new Error(message);
    }
    throw new Error(error.message || 'Network error. Check your connection and try again.');
  }
  return data as T;
}

export function errorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}
