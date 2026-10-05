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
  insertContactWithinLimit(row: Row): Promise<Row | undefined>;
  update(table: Table, id: string, row: Row): Promise<Row | undefined>;
  updateUserIfPasswordMatches(id: string, passwordDigest: string, row: Row): Promise<Row | undefined>;
  remove(table: Table, id: string): Promise<void>;
  consumeToken(digest: string, purpose: string): Promise<Row | undefined>;
}
export class MemoryStore implements Store {
  memory = true;
  data = new Map<Table, Row[]>();
  async list(t: Table, w: Row = {}): Promise<Row[]> {
    return (this.data.get(t) || [])
      .filter((r) => Object.entries(w).every(([k, v]) => r[k] === v))
      .map((r) => structuredClone(r));
  }
  async insert(t: Table, r: Row): Promise<Row> {
    const rows = this.data.get(t) || [];
    if (
      (t === 'users' && rows.some((x) => x.email === r.email)) ||
      (t === 'reports' && rows.some((x) => x.userId === r.userId && x.entity === r.entity)) ||
      (t === 'contacts' && rows.some((x) => x.userId === r.userId && x.email === r.email))
      || (['brands', 'threatCategories'].includes(t) && rows.some((x) => x.name === r.name))
    )
      throw Object.assign(new Error('Already exists'), { code: '23505' });
    const row = { id: randomUUID(), createdAt: new Date(), ...structuredClone(r) };
    rows.push(row);
    this.data.set(t, rows);
    return structuredClone(row);
  }
  async update(t: Table, id: string, r: Row): Promise<Row | undefined> {
    const row = (this.data.get(t) || []).find((x) => x.id === id);
    if (row) Object.assign(row, structuredClone(r));
    return row ? structuredClone(row) : undefined;
  }
  async insertContactWithinLimit(row: Row): Promise<Row | undefined> {
    // No await between the count and insertion: concurrent demo calls cannot
    // observe the same free slot. insert() mutates synchronously before resolving.
    if ((this.data.get('contacts') || []).filter((contact) => contact.userId === row.userId).length >= 10) return undefined;
    return this.insert('contacts', row);
  }
  async remove(t: Table, id: string) {
    this.data.set(
      t,
      (this.data.get(t) || []).filter((x) => x.id !== id),
    );
    // Match the persistent schema so demo alerts do not retain dangling IDs.
    if (t === 'scans' || t === 'contacts') {
      const key = t === 'scans' ? 'scanId' : 'contactId';
      for (const alert of this.data.get('alerts') || []) if (alert[key] === id) alert[key] = null;
    }
  }
  async updateUserIfPasswordMatches(id: string, passwordDigest: string, changes: Row): Promise<Row | undefined> {
    const user = (this.data.get('users') || []).find((row) => row.id === id && row.passwordHash === passwordDigest);
    if (!user) return undefined;
    Object.assign(user, structuredClone(changes));
    return structuredClone(user);
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
  const sql = neon(config.databaseUrl);
  const db = drizzle(sql);
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
    async insertContactWithinLimit(row) {
      // The lock and count must be different statements at ReadCommitted.
      // A waiting caller obtains a fresh count snapshot after the previous
      // transaction commits; a single CTE would not provide that guarantee.
      const results = await sql.transaction([
        sql`SELECT id FROM users WHERE id = ${row.userId} FOR UPDATE`,
        sql`INSERT INTO trusted_contacts (user_id, name, email)
          SELECT ${row.userId}, ${row.name}, ${row.email}
          WHERE (SELECT COUNT(*) FROM trusted_contacts WHERE user_id = ${row.userId}) < 10
          RETURNING id, user_id, name, email, created_at`,
      ], { isolationLevel: 'ReadCommitted' });
      const inserted = results[1][0];
      return inserted ? {
        id: inserted.id, userId: inserted.user_id, name: inserted.name,
        email: inserted.email, createdAt: inserted.created_at,
      } : undefined;
    },
    async remove(t, id) {
      await db.delete(tables[t]).where(eq(tables[t].id, id));
    },
    async updateUserIfPasswordMatches(id, passwordDigest, changes) {
      return (await db.update(tables.users).set(changes)
        .where(and(eq(tables.users.id, id), eq(tables.users.passwordHash, passwordDigest))).returning())[0];
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
