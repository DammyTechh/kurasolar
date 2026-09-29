/** Typed access to function secrets. Missing required values fail loudly at call time. */
export function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name) ?? fallback;
  if (value === undefined || value === '') throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const optionalEnv = (name: string) => Deno.env.get(name) || undefined;

/** Public site URL without trailing slash, e.g. https://kurasolar.ng */
export const appUrl = () => env('APP_URL', 'http://localhost:5173').replace(/\/+$/, '');
