import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before migrating.');
await migrate(drizzle(neon(process.env.DATABASE_URL)), { migrationsFolder: 'migrations' });
console.log('Migrations applied.');
