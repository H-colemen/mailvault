import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { settings } from "@db/schema";

export const settingsRouter = createRouter({
  get: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userSettings = await db.query.settings.findFirst({
      where: eq(settings.userId, ctx.user!.id),
    });

    if (!userSettings) {
      // Create default settings
      const [newSettings] = await db
        .insert(settings)
        .values({
          userId: ctx.user!.id,
        })
        .returning();
      return newSettings;
    }

    return userSettings;
  }),

  update: authedQuery
    .input(
      z.object({
        theme: z.enum(["light", "dark", "system"]).optional(),
        language: z.string().optional(),
        timezone: z.string().optional(),
        dateFormat: z.string().optional(),
        autoRefresh: z.number().nullable().optional(),
        notificationsEnabled: z.boolean().optional(),
        soundEnabled: z.boolean().optional(),
        signature: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const existing = await db.query.settings.findFirst({
        where: eq(settings.userId, ctx.user!.id),
      });

      if (!existing) {
        const [newSettings] = await db
          .insert(settings)
          .values({
            userId: ctx.user!.id,
            ...input,
          })
          .returning();
        return newSettings;
      }

      const [updated] = await db
        .update(settings)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(settings.userId, ctx.user!.id))
        .returning();

      return updated;
    }),
});
