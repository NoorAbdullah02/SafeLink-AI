import 'dotenv/config';
export function readConfig(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === 'production';
  const integer = (name: string, fallback: number, min: number, max: number) => {
    const value = env[name] ? Number(env[name]) : fallback;
    if (!Number.isInteger(value) || value < min || value > max)
      throw new Error(`${name} must be an integer from ${min} to ${max}.`);
    return value;
  };
  const appUrl = env.APP_URL || env.RENDER_EXTERNAL_URL || 'http://localhost:5173';
  let parsed: URL;
  try { parsed = new URL(appUrl); } catch { throw new Error('APP_URL must be a valid application URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash)
    throw new Error('APP_URL must use HTTP or HTTPS without credentials, a query or a fragment.');
  if (production && parsed.protocol !== 'https:') throw new Error('Production APP_URL must use HTTPS.');
  const memory = env.DEMO_MEMORY === 'true';
  if (production && memory) throw new Error('Temporary demo storage is not allowed in production.');
  return {
    production,
    port: integer('PORT', 3001, 1, 65535),
    appUrl: parsed.href.replace(/\/$/, ''),
    databaseUrl: env.DATABASE_URL,
    memory,
    retentionDays: integer('RETENTION_DAYS', 30, 1, 3650),
    trustProxyHops: integer('TRUST_PROXY_HOPS', 0, 0, 16),
  };
}
export const config = readConfig(process.env);

export function allowedOrigins(appUrl = config.appUrl, production = config.production) {
  const primary = new URL(appUrl).origin;
  const renderOrigin = process.env.RENDER_EXTERNAL_URL
    ? new URL(process.env.RENDER_EXTERNAL_URL).origin
    : undefined;
  return new Set([
    primary,
    ...(renderOrigin && renderOrigin !== primary ? [renderOrigin] : []),
    ...(!production ? ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'] : []),
  ]);
}
