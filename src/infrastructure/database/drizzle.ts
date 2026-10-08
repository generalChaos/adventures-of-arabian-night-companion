import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Direct Postgres connection for game commands (real transactions).
 * Use the Supabase transaction-mode pooler (port 6543) in production
 * with prepare: false for serverless.
 */
export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
  });

  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

let singleton: Db | null = null;

export function getDb(): Db {
  if (!singleton) singleton = createDb();
  return singleton;
}
