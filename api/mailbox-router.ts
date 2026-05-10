import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { mailboxes, domains } from "@db/schema";

export const mailboxRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        domainId: z.string().uuid().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [eq(mailboxes.userId, ctx.user!.id)];

      if (input?.domainId) {
        conditions.push(eq(mailboxes.domainId, input.domainId));
      }

      const mailboxList = await db.query.mailboxes.findMany({
        where: and(...conditions),
        with: {
          domain: true,
        },
        orderBy: [sql`${mailboxes.createdAt} desc`],
      });

      return mailboxList;
    }),

  get: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const mailbox = await db.query.mailboxes.findFirst({
        where: and(eq(mailboxes.id, input.id), eq(mailboxes.userId, ctx.user!.id)),
        with: {
          domain: true,
        },
      });

      if (!mailbox) {
        throw new Error("Mailbox not found");
      }

      return mailbox;
    }),

  create: authedQuery
    .input(
      z.object({
        domainId: z.string().uuid(),
        localPart: z.string().min(1).max(64),
        name: z.string().max(255).optional(),
        isCatchAll: z.boolean().optional(),
        isAlias: z.boolean().optional(),
        forwardTo: z.string().email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verify domain belongs to user
      const domain = await db.query.domains.findFirst({
        where: and(eq(domains.id, input.domainId), eq(domains.userId, ctx.user!.id)),
      });

      if (!domain) {
        throw new Error("Domain not found");
      }

      const address = input.isCatchAll
        ? `@${domain.domainName}`
        : `${input.localPart}@${domain.domainName}`;

      const [mailbox] = await db
        .insert(mailboxes)
        .values({
          domainId: input.domainId,
          userId: ctx.user!.id,
          address,
          name: input.name || input.localPart,
          isCatchAll: input.isCatchAll || false,
          isAlias: input.isAlias || false,
          forwardTo: input.forwardTo,
          active: true,
        })
        .returning();

      return mailbox;
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().max(255).optional(),
        forwardTo: z.string().email().nullable().optional(),
        autoReply: z.boolean().optional(),
        autoReplyMessage: z.string().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      const [mailbox] = await db
        .update(mailboxes)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(eq(mailboxes.id, id), eq(mailboxes.userId, ctx.user!.id)))
        .returning();

      if (!mailbox) {
        throw new Error("Mailbox not found");
      }

      return mailbox;
    }),

  delete: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(mailboxes)
        .where(and(eq(mailboxes.id, input.id), eq(mailboxes.userId, ctx.user!.id)));

      return { success: true };
    }),

  // Toggle active status
  toggleActive: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const mailbox = await db.query.mailboxes.findFirst({
        where: and(eq(mailboxes.id, input.id), eq(mailboxes.userId, ctx.user!.id)),
      });

      if (!mailbox) {
        throw new Error("Mailbox not found");
      }

      const [updated] = await db
        .update(mailboxes)
        .set({ active: !mailbox.active, updatedAt: new Date() })
        .where(eq(mailboxes.id, input.id))
        .returning();

      return updated;
    }),
});
