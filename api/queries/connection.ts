import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let pool: ReturnType<typeof postgres> | undefined;
let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  console.log("[db] Getting connection, POOL exists:", !!pool);
  if (!pool) {
    console.error("[db] POOL IS NULL - check DATABASE_URL");
    // Use Supabase database URL if available, fallback to regular DATABASE_URL
    const connectionString = env.supabaseDatabaseUrl || env.databaseUrl;
    
    if (!connectionString) {
      throw new Error("No database connection string configured. Set SUPABASE_DATABASE_URL or DATABASE_URL in .env");
    }
    
    // For Supabase, we need to handle the connection pooling
    pool = postgres(connectionString, {
      prepare: false,
      max: 10,
    });
  }

  if (!instance) {
    instance = drizzle(pool, {
      schema: fullSchema,
    });
  }

  return instance;
}
