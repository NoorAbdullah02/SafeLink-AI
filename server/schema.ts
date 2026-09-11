import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
const id = () => uuid('id').primaryKey().defaultRandom();
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const users = pgTable('users', {
  id: id(),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text().notNull().default('user'),
  verified: boolean().notNull().default(false),
  disabled: boolean().notNull().default(false),
  simpleMode: boolean('simple_mode').notNull().default(false),
  createdAt: created(),
});
export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: created(),
});
export const authTokens = pgTable('auth_tokens', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  purpose: text().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: created(),
});
export const scans = pgTable(
  'scans',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    score: integer().notNull(),
    level: text().notNull(),
    saved: boolean().notNull().default(false),
    result: jsonb().notNull(),
    createdAt: created(),
  },
  (t) => [index('scans_user_date').on(t.userId, t.createdAt)],
);
export const reports = pgTable(
  'community_reports',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entity: text().notNull(),
    entityType: text('entity_type').notNull(),
    category: text().notNull(),
    description: text().notNull(),
    status: text().notNull().default('pending'),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex('reports_user_entity').on(t.userId, t.entity),
    index('reports_entity_status').on(t.entity, t.status),
  ],
);
export const contacts = pgTable(
  'trusted_contacts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    email: text().notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex('contacts_user_email').on(t.userId, t.email)],
);
export const alerts = pgTable('security_alerts', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  scanId: uuid('scan_id').references(() => scans.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  status: text().notNull(),
  createdAt: created(),
});
export const brands = pgTable('brands', {
  id: id(),
  name: text().notNull().unique(),
  aliases: jsonb().notNull(),
  domains: jsonb().notNull(),
  createdAt: created(),
});
export const threatCategories = pgTable('threat_categories', {
  id: id(),
  name: text().notNull().unique(),
  createdAt: created(),
});
export const adminLogs = pgTable('admin_logs', {
  id: id(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text().notNull(),
  target: text().notNull(),
  createdAt: created(),
});
export const tables = {
  users,
  sessions,
  authTokens,
  scans,
  reports,
  contacts,
  alerts,
  brands,
  threatCategories,
  adminLogs,
};
