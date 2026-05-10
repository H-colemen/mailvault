import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";

export async function findUserByEmail(email: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return rows.at(0);
}

export async function upsertUser(data: InsertUser) {
  const existing = await findUserByEmail(data.email);
  
  if (existing) {
    await getDb()
      .update(schema.users)
      .set({
        ...data,
        updatedAt: new Date(),
        lastSignInAt: new Date(),
      })
      .where(eq(schema.users.id, existing.id));
    return existing;
  } else {
    const [user] = await getDb()
      .insert(schema.users)
      .values({
        ...data,
        lastSignInAt: new Date(),
      })
      .returning();
    return user;
  }
}
