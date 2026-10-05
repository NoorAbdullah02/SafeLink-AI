import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { tables } from '../server/schema.js';
import { localScan } from '../server/engine.js';
import { aiSettings, enrich } from '../server/providers.js';
import { askCyberAssistant } from '../server/assistant.js';
import { mkdir, writeFile } from 'node:fs/promises';

// Read-only database metadata. --providers uses only the synthetic sample below.
// Never send email or create/change a real account in this diagnostic.
const report: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
  configured: {
    database: Boolean(process.env.DATABASE_URL),
    email: Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL),
    ai: Boolean(aiSettings()),
    intelligence: Boolean(process.env.SAFE_BROWSING_API_KEY),
  },
};

if (process.env.DATABASE_URL) {
  try {
    const sql = neon(process.env.DATABASE_URL, {
      fetchOptions: { signal: AbortSignal.timeout(20_000) },
    });
    await sql`SELECT 1 AS connection_check`;
    const columns = await sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
    `;
    const missing = Object.values(tables).flatMap((table) => {
      const name = getTableName(table);
      return Object.values(getTableColumns(table))
        .filter(
          (column) =>
            !columns.some((row) => row.table_name === name && row.column_name === column.name),
        )
        .map((column) => `${name}.${column.name}`);
    });
    report.database = {
      connected: true,
      expectedTables: Object.keys(tables).length,
      missingColumns: missing,
      mode: 'read-only schema metadata; no row data read or written',
    };
  } catch (error) {
    report.database = {
      connected: false,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    };
  }
}

if (process.argv.includes('--providers')) {
  const sample =
    'Apnar bKash account bondho hoye jabe! Ekhoni https://bkash-verify.example/login e apnar PIN din.';
  const result = await enrich(localScan(sample, 'message'), sample, true);
  const assistant = await askCyberAssistant(
    'What should I do if an unexpected message asks me to share a PIN?',
    [],
    true,
  );
  report.externalChecks = {
    input: 'Synthetic reserved-domain message; no private information',
    checks: result.checks,
    aiExplanationReturned: Boolean(result.aiExplanation),
    assistant: { source: assistant.source, externalUsed: assistant.externalUsed },
    limitation: 'Connectivity/response contract only; no accuracy or advice-quality evaluation',
  };
  if (!result.aiExplanation && aiSettings()) {
    const settings = aiSettings()!;
    try {
      const response = await fetch(settings.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: 40,
          messages: [{ role: 'user', content: 'Reply with the word ready.' }],
        }),
      });
      const body: any = await response.json().catch(() => ({}));
      report.aiDiagnostic = {
        host: new URL(settings.endpoint).hostname,
        model: settings.model,
        httpStatus: response.status,
        errorType: typeof body.error?.type === 'string' ? body.error.type.slice(0, 80) : undefined,
        errorCode: typeof body.error?.code === 'string' ? body.error.code.slice(0, 80) : undefined,
      };
    } catch (error) {
      report.aiDiagnostic = { errorType: error instanceof Error ? error.name : 'UnknownError' };
    }
  }
}

if (process.argv.includes('--email-config') && process.env.BREVO_API_KEY) {
  try {
    const response = await fetch('https://api.brevo.com/v3/senders', {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { accept: 'application/json', 'api-key': process.env.BREVO_API_KEY },
    });
    const body: any = await response.json().catch(() => ({}));
    const sender = Array.isArray(body.senders)
      ? body.senders.find(
          (entry: any) =>
            typeof entry.email === 'string' &&
            entry.email.toLowerCase() === process.env.BREVO_SENDER_EMAIL?.toLowerCase(),
        )
      : undefined;
    report.emailConfiguration = {
      httpStatus: response.status,
      configuredSenderFound: Boolean(sender),
      configuredSenderActive: sender?.active === true,
      mode: 'Read-only sender metadata; no sender identities printed and no email sent',
    };
  } catch (error) {
    report.emailConfiguration = { errorType: error instanceof Error ? error.name : 'UnknownError' };
  }
}

await mkdir('work/verification', { recursive: true });
const reportKind = process.argv.includes('--providers')
  ? 'providers'
  : process.argv.includes('--email-config')
    ? 'email-config'
    : 'database';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = `work/verification/${stamp}-${reportKind}.json`;
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`Diagnostic report saved to ${reportPath}`);
