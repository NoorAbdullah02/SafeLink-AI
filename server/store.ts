import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, gt } from 'drizzle-orm';
import { tables } from './schema.js';
import { config } from './config.js';
type Table = keyof typeof tables;
export type Row = Record<string, any>;
export interface Store {
  memory: boolean;
  list(table: Table, where?: Row): Promise<Row[]>;
  insert(table: Table, row: Row): Promise<Row>;
  update(table: Table, id: string, row: Row): Promise<Row | undefined>;
  remove(table: Table, id: string): Promise<void>;
  consumeToken(digest: string, purpose: string): Promise<Row | undefined>;
}
export class MemoryStore implements Store {
  memory = true;
  data = new Map<Table, Row[]>();
  async list(t: Table, w: Row = {}) {
    return (this.data.get(t) || [])
      .filter((r) => Object.entries(w).every(([k, v]) => r[k] === v))
      .map((r) => ({ ...r }));
  }
  async insert(t: Table, r: Row) {
    const rows = this.data.get(t) || [];
    if (
      (t === 'users' && rows.some((x) => x.email === r.email)) ||
      (t === 'reports' && rows.some((x) => x.userId === r.userId && x.entity === r.entity)) ||
      (t === 'contacts' && rows.some((x) => x.userId === r.userId && x.email === r.email))
    )
      throw Object.assign(new Error('Already exists'), { code: '23505' });
    const row = { id: randomUUID(), createdAt: new Date(), ...r };
    rows.push(row);
    this.data.set(t, rows);
    return { ...row };
  }
  async update(t: Table, id: string, r: Row) {
    const row = (this.data.get(t) || []).find((x) => x.id === id);
    if (row) Object.assign(row, r);
    return row ? { ...row } : undefined;
  }
  async remove(t: Table, id: string) {
    this.data.set(
      t,
      (this.data.get(t) || []).filter((x) => x.id !== id),
    );
  }
  async consumeToken(digest: string, purpose: string) {
    const rows = this.data.get('authTokens') || [];
    const row = rows.find(
      (r) => r.tokenHash === digest && r.purpose === purpose && +new Date(r.expiresAt) > Date.now(),
    );
    if (row)
      this.data.set(
        'authTokens',
        rows.filter((r) => r.id !== row.id),
      );
    return row;
  }
}
export function createStore(): Store {
  if (config.memory && !config.production) return new MemoryStore();
  if (!config.databaseUrl) {
    throw new Error(
      'DATABASE_URL required. For local development only, explicitly set DEMO_MEMORY=true.',
    );
  }
  const db = drizzle(neon(config.databaseUrl));
  return {
    memory: false,
    async list(t, w = {}) {
      const table: any = tables[t];
      return db
        .select()
        .from(table)
        .where(and(...Object.entries(w).map(([k, v]) => eq(table[k], v))));
    },
    async insert(t, row) {
      return (
        (await db
          .insert(tables[t] as any)
          .values(row)
          .returning()) as Row[]
      )[0];
    },
    async update(t, id, row) {
      return (
        await db
          .update(tables[t] as any)
          .set(row)
          .where(eq(tables[t].id, id))
          .returning()
      )[0];
    },
    async remove(t, id) {
      await db.delete(tables[t]).where(eq(tables[t].id, id));
    },
    async consumeToken(digest, purpose) {
      return (
        await db
          .delete(tables.authTokens)
          .where(
            and(
              eq(tables.authTokens.tokenHash, digest),
              eq(tables.authTokens.purpose, purpose),
              gt(tables.authTokens.expiresAt, new Date()),
            ),
          )
          .returning()
      )[0];
    },
  };
}
