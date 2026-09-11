import 'dotenv/config';
export const config = {
  production: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3001),
  appUrl: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  memory: process.env.DEMO_MEMORY === 'true',
  retentionDays: Math.max(1, Number(process.env.RETENTION_DAYS || 30)),
};

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
