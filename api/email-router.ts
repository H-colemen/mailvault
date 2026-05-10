import { z } from "zod";
import { eq, and, desc, asc, ilike, or, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { emails } from "@db/schema";

const listInput = z.object({
  status: z.enum(["active", "archived", "spam", "trashed", "deleted"]).optional(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  isDraft: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  mailboxId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  sortBy: z.enum(["receivedAt", "sentAt", "createdAt"]).default("receivedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const emailRouter = createRouter({
  list: authedQuery
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user!.id;
      const filters = input;
      const page = filters.page || 1;
      const pageSize = filters.pageSize || 20;
      const offset = (page - 1) * pageSize;

      const conditions = [eq(emails.userId, userId)];

      if (filters.status) {
        conditions.push(eq(emails.status, filters.status));
      }
      if (filters.direction) {
        conditions.push(eq(emails.direction, filters.direction));
      }
      if (filters.isDraft !== undefined) {
        conditions.push(eq(emails.isDraft, filters.isDraft));
      }
      if (filters.isStarred !== undefined) {
        conditions.push(eq(emails.isStarred, filters.isStarred));
      }
      if (filters.mailboxId) {
        conditions.push(eq(emails.mailboxId, filters.mailboxId));
      }
      if (filters.threadId) {
        conditions.push(eq(emails.threadId, filters.threadId));
      }

      // Search functionality
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        conditions.push(
          or(
            ilike(emails.subject, searchTerm),
            ilike(emails.senderEmail, searchTerm),
            ilike(emails.senderName, searchTerm),
            ilike(emails.bodyText, searchTerm),
            ilike(emails.bodyPreview, searchTerm),
          )!,
        );
      }

      // Default: exclude deleted and drafts unless explicitly requested
      if (filters.status === undefined && filters.isDraft === undefined) {
        conditions.push(sql`${emails.status} != 'deleted'`);
        conditions.push(eq(emails.isDraft, false));
      }

      const sortColumn = filters.sortBy === "sentAt" ? emails.sentAt :
                        filters.sortBy === "createdAt" ? emails.createdAt :
                        emails.receivedAt;
      const sortFn = filters.sortOrder === "asc" ? asc : desc;

      const [emailList, countResult] = await Promise.all([
        db.query.emails.findMany({
          where: and(...conditions),
          orderBy: [sortFn(sortColumn)],
          limit: pageSize,
          offset,
          with: {
            attachments: true,
            thread: true,
          },
        }),
        db.select({ count: sql<number>`count(*)` })
          .from(emails)
          .where(and(...conditions)),
      ]);

      return {
        emails: emailList,
        pagination: {
          page,
          pageSize,
          total: Number(countResult[0]?.count || 0),
          totalPages: Math.ceil(Number(countResult[0]?.count || 0) / pageSize),
        },
      };
    }),

  get: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const email = await db.query.emails.findFirst({
        where: and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id)),
        with: {
          attachments: true,
          thread: {
            with: {
              emails: {
                orderBy: [asc(emails.receivedAt)],
              },
            },
          },
        },
      });

      if (!email) {
        throw new Error("Email not found");
      }

      return email;
    }),

  markRead: authedQuery
    .input(z.object({ id: z.string().uuid(), isRead: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(emails)
        .set({ isRead: input.isRead, updatedAt: new Date() })
        .where(and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id)));

      return { success: true };
    }),

  toggleStar: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const email = await db.query.emails.findFirst({
        where: and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id)),
      });

      if (!email) {
        throw new Error("Email not found");
      }

      await db
        .update(emails)
        .set({ isStarred: !email.isStarred, updatedAt: new Date() })
        .where(eq(emails.id, input.id));

      return { success: true, isStarred: !email.isStarred };
    }),

  archive: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(emails)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id)));

      return { success: true };
    }),

  unarchive: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(emails)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id)));

      return { success: true };
    }),

  trash: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(emails)
        .set({ status: "trashed", updatedAt: new Date() })
        .where(and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id)));

      return { success: true };
    }),

  restore: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(emails)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id)));

      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(emails)
        .set({ status: "deleted", updatedAt: new Date() })
        .where(and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id)));

      return { success: true };
    }),

  markSpam: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(emails)
        .set({ status: "spam", updatedAt: new Date() })
        .where(and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id)));

      return { success: true };
    }),

  notSpam: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(emails)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id)));

      return { success: true };
    }),

  bulkAction: authedQuery
    .input(
      z.object({
        ids: z.array(z.string().uuid()),
        action: z.enum(["read", "unread", "star", "unstar", "archive", "trash", "delete", "spam", "notSpam"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      switch (input.action) {
        case "read":
          updates.isRead = true;
          break;
        case "unread":
          updates.isRead = false;
          break;
        case "star":
          updates.isStarred = true;
          break;
        case "unstar":
          updates.isStarred = false;
          break;
        case "archive":
          updates.status = "archived";
          break;
        case "trash":
          updates.status = "trashed";
          break;
        case "delete":
          updates.status = "deleted";
          break;
        case "spam":
          updates.status = "spam";
          break;
        case "notSpam":
          updates.status = "active";
          break;
      }

      for (const id of input.ids) {
        await db
          .update(emails)
          .set(updates)
          .where(and(eq(emails.id, id), eq(emails.userId, ctx.user!.id)));
      }

      return { success: true, count: input.ids.length };
    }),

  stats: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user!.id;

    const [inboxCount, sentCount, draftCount, trashCount, spamCount, archiveCount, unreadCount, starredCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(and(eq(emails.userId, userId), eq(emails.status, "active"), eq(emails.isDraft, false), eq(emails.direction, "inbound"))),
      db.select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(and(eq(emails.userId, userId), eq(emails.direction, "outbound"), eq(emails.isDraft, false))),
      db.select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(and(eq(emails.userId, userId), eq(emails.isDraft, true))),
      db.select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(and(eq(emails.userId, userId), eq(emails.status, "trashed"))),
      db.select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(and(eq(emails.userId, userId), eq(emails.status, "spam"))),
      db.select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(and(eq(emails.userId, userId), eq(emails.status, "archived"))),
      db.select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(and(eq(emails.userId, userId), eq(emails.isRead, false), eq(emails.isDraft, false))),
      db.select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(and(eq(emails.userId, userId), eq(emails.isStarred, true))),
    ]);

    return {
      inbox: Number(inboxCount[0]?.count || 0),
      sent: Number(sentCount[0]?.count || 0),
      drafts: Number(draftCount[0]?.count || 0),
      trash: Number(trashCount[0]?.count || 0),
      spam: Number(spamCount[0]?.count || 0),
      archive: Number(archiveCount[0]?.count || 0),
      unread: Number(unreadCount[0]?.count || 0),
      starred: Number(starredCount[0]?.count || 0),
    };
  }),

  search: authedQuery
    .input(
      z.object({
        query: z.string().min(1),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user!.id;
      const searchTerm = `%${input.query}%`;
      const offset = (input.page - 1) * input.pageSize;

      const conditions = [
        eq(emails.userId, userId),
        sql`${emails.status} != 'deleted'`,
        or(
          ilike(emails.subject, searchTerm),
          ilike(emails.senderEmail, searchTerm),
          ilike(emails.senderName, searchTerm),
          ilike(emails.bodyText, searchTerm),
          ilike(emails.bodyPreview, searchTerm),
        )!,
      ];

      const [emailList, countResult] = await Promise.all([
        db.query.emails.findMany({
          where: and(...conditions),
          orderBy: [desc(emails.receivedAt)],
          limit: input.pageSize,
          offset,
          with: {
            attachments: true,
          },
        }),
        db.select({ count: sql<number>`count(*)` })
          .from(emails)
          .where(and(...conditions)),
      ]);

      return {
        emails: emailList,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: Number(countResult[0]?.count || 0),
          totalPages: Math.ceil(Number(countResult[0]?.count || 0) / input.pageSize),
        },
      };
    }),
});
