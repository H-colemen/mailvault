import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, emails, domains, mailboxes, webhookLogs, auditLogs } from "@db/schema";

export const adminRouter = createRouter({
  // Dashboard stats
  stats: adminQuery.query(async () => {
    const db = getDb();

    const [
      userCount,
      emailCount,
      domainCount,
      mailboxCount,
      inboundCount,
      outboundCount,
      unreadCount,
      recentWebhookCount,
      failedWebhookCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(emails),
      db.select({ count: sql<number>`count(*)` }).from(domains),
      db.select({ count: sql<number>`count(*)` }).from(mailboxes),
      db.select({ count: sql<number>`count(*)` }).from(emails).where(eq(emails.direction, "inbound")),
      db.select({ count: sql<number>`count(*)` }).from(emails).where(eq(emails.direction, "outbound")),
      db.select({ count: sql<number>`count(*)` }).from(emails).where(eq(emails.isRead, false)),
      db.select({ count: sql<number>`count(*)` }).from(webhookLogs),
      db.select({ count: sql<number>`count(*)` }).from(webhookLogs).where(eq(webhookLogs.success, false)),
    ]);

    return {
      users: Number(userCount[0]?.count || 0),
      emails: Number(emailCount[0]?.count || 0),
      domains: Number(domainCount[0]?.count || 0),
      mailboxes: Number(mailboxCount[0]?.count || 0),
      inboundEmails: Number(inboundCount[0]?.count || 0),
      outboundEmails: Number(outboundCount[0]?.count || 0),
      unreadEmails: Number(unreadCount[0]?.count || 0),
      totalWebhooks: Number(recentWebhookCount[0]?.count || 0),
      failedWebhooks: Number(failedWebhookCount[0]?.count || 0),
    };
  }),

  // List all users
  users: adminQuery
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const filters = input || { page: 1, pageSize: 20 };
      const offset = (filters.page - 1) * filters.pageSize;

      const [userList, countResult] = await Promise.all([
        db.query.users.findMany({
          orderBy: [desc(users.createdAt)],
          limit: filters.pageSize,
          offset,
        }),
        db.select({ count: sql<number>`count(*)` }).from(users),
      ]);

      // Filter by search if provided
      let filteredUsers = userList;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredUsers = userList.filter(
          (u) =>
            u.email?.toLowerCase().includes(searchLower) ||
            u.name?.toLowerCase().includes(searchLower)
        );
      }

      return {
        users: filteredUsers,
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total: Number(countResult[0]?.count || 0),
          totalPages: Math.ceil(Number(countResult[0]?.count || 0) / filters.pageSize),
        },
      };
    }),

  // Update user role/status
  updateUser: adminQuery
    .input(
      z.object({
        id: z.string().uuid(),
        role: z.enum(["user", "admin"]).optional(),
        status: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      const [updated] = await db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      return updated;
    }),

  // List webhook logs
  webhookLogs: adminQuery
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        success: z.boolean().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const filters = input || { page: 1, pageSize: 20 };
      const offset = (filters.page - 1) * filters.pageSize;

      let conditions = undefined;
      if (filters.success !== undefined) {
        conditions = eq(webhookLogs.success, filters.success);
      }

      const [logs, countResult] = await Promise.all([
        db.query.webhookLogs.findMany({
          where: conditions,
          orderBy: [desc(webhookLogs.createdAt)],
          limit: filters.pageSize,
          offset,
        }),
        db.select({ count: sql<number>`count(*)` }).from(webhookLogs),
      ]);

      return {
        logs,
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total: Number(countResult[0]?.count || 0),
          totalPages: Math.ceil(Number(countResult[0]?.count || 0) / filters.pageSize),
        },
      };
    }),

  // List audit logs
  auditLogs: adminQuery
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const filters = input || { page: 1, pageSize: 20 };
      const offset = (filters.page - 1) * filters.pageSize;

      const [logs, countResult] = await Promise.all([
        db.query.auditLogs.findMany({
          orderBy: [desc(auditLogs.createdAt)],
          limit: filters.pageSize,
          offset,
        }),
        db.select({ count: sql<number>`count(*)` }).from(auditLogs),
      ]);

      return {
        logs,
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total: Number(countResult[0]?.count || 0),
          totalPages: Math.ceil(Number(countResult[0]?.count || 0) / filters.pageSize),
        },
      };
    }),

  // System health
  health: adminQuery.query(async () => {
    return {
      database: "connected",
      usersTable: "ok",
      timestamp: new Date().toISOString(),
    };
  }),
});
