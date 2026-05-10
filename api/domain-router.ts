import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { domains, mailboxes } from "@db/schema";
import { nanoid } from "nanoid";
import { env } from "./lib/env";

export const domainRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    console.log("[domain.list] Starting for user:", ctx.user?.id);
    try {
      const db = getDb();
      console.log("[domain.list] Got DB connection");
      
      const domainList = await db.query.domains.findMany({
        where: eq(domains.userId, ctx.user!.id),
        with: {
          mailboxes: true,
        },
        orderBy: [sql`${domains.createdAt} desc`],
      });
      
      console.log("[domain.list] Found domains:", domainList.length);
      return domainList;
    } catch (error) {
      console.error("[domain.list] CRASH:", error);
      throw error; // Re-throw so tRPC returns 500 with details
    }
  }),

  get: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const domain = await db.query.domains.findFirst({
        where: and(eq(domains.id, input.id), eq(domains.userId, ctx.user!.id)),
        with: {
          mailboxes: true,
        },
      });

      if (!domain) {
        throw new Error("Domain not found");
      }

      return domain;
    }),

  create: authedQuery
    .input(
      z.object({
        domainName: z.string().min(1).max(255),
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Debug: Check Resend API key
      console.log("[domain] Resend API key present:", !!env.resendApiKey);
      console.log("[domain] Resend API key length:", env.resendApiKey?.length || 0);

      // Generate verification token
      const verificationToken = nanoid(32);

      let resendDomainId: string | null = null;
      let resendDomainData: any = null;

      if (env.resendApiKey) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(env.resendApiKey);
          
          console.log("[domain] Creating domain in Resend:", input.domainName.toLowerCase());
          const response = await resend.domains.create({ name: input.domainName.toLowerCase() });
          
          console.log("[domain] Raw Resend response:", JSON.stringify(response, null, 2));
          console.log("[domain] Response type:", typeof response);
          console.log("[domain] Response keys:", Object.keys(response || {}));

          // Handle different Resend response shapes
          if (response && typeof response === "object") {
            // Check if it's an error response
            if ((response as any).error) {
              console.error("[domain] Resend returned error:", response);
              throw new Error((response as any).error?.message || "Resend API error");
            }

            // Extract ID - Resend returns { id: "..." } or { data: { id: "..." } }
            const possibleId = (response as any).id 
              || (response as any).data?.id 
              || (response as any).domain?.id;

            if (possibleId && typeof possibleId === "string") {
              resendDomainId = possibleId.trim() || null;
              resendDomainData = response;
              console.log("[domain] Extracted Resend domain ID:", resendDomainId);
            } else {
              console.warn("[domain] No ID found in Resend response");
            }
          }
        } catch (error: any) {
          console.error("[domain] Failed to create domain in Resend:", error);
          // Log the full error details
          if (error.response) {
            console.error("[domain] Resend error response:", error.response);
          }
          resendDomainId = null;
        }
      } else {
        console.log("[domain] Resend API key not configured, skipping Resend domain creation");
      }

      console.log("[domain] About to insert domain with final values:", {
        userId: ctx.user!.id,
        domainName: input.domainName.toLowerCase(),
        verificationToken: "***",
        resendDomainId,
        resendDomainIdType: typeof resendDomainId,
        resendDomainIdIsNull: resendDomainId === null,
        resendVerified: false,
        isDefault: input.isDefault || false,
      });

      const [domain] = await db
        .insert(domains)
        .values({
          userId: ctx.user!.id,
          domainName: input.domainName.toLowerCase(),
          verificationToken,
          resendDomainId: resendDomainId || null, // Ensure null, never undefined or empty string
          resendVerified: false,
          isDefault: input.isDefault || false,
        })
        .returning();

      // Create default mailbox (catch-all)
      await db.insert(mailboxes).values({
        domainId: domain.id,
        userId: ctx.user!.id,
        address: `@${domain.domainName}`,
        name: "Catch-all",
        isCatchAll: true,
        active: true,
      });

      return domain;
    }),

  verify: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const domain = await db.query.domains.findFirst({
        where: and(eq(domains.id, input.id), eq(domains.userId, ctx.user!.id)),
      });

      if (!domain) {
        throw new Error("Domain not found");
      }

      let verified = true;
      let resendVerified = domain.resendVerified || false;

      if (env.resendApiKey && domain.resendDomainId) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(env.resendApiKey);
          await resend.domains.verify(domain.resendDomainId);
          resendVerified = true;
        } catch (error) {
          console.error("[domain] Resend domain verification failed:", error);
          verified = false;
          resendVerified = false;
        }
      }

      const [updated] = await db
        .update(domains)
        .set({
          verified,
          resendVerified,
          mxConfigured: verified,
          spfConfigured: verified,
          dkimConfigured: verified,
          dmarcConfigured: verified,
          updatedAt: new Date(),
        })
        .where(eq(domains.id, input.id))
        .returning();

      return updated;
    }),

  setupResendWebhook: authedQuery
    .input(z.object({ id: z.string().uuid(), webhookUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      if (!env.resendApiKey) {
        throw new Error("Resend API key is not configured");
      }

      const db = getDb();
      const domain = await db.query.domains.findFirst({
        where: and(eq(domains.id, input.id), eq(domains.userId, ctx.user!.id)),
      });

      if (!domain) {
        throw new Error("Domain not found");
      }

      try {
        const { Resend } = await import("resend");
        const resend = new Resend(env.resendApiKey);
        const webhook = await (resend.webhooks as any).create({
          url: input.webhookUrl,
          events: ["email.received"],
          secret: env.resendWebhookSecret || undefined,
        });

        const [updated] = await db
          .update(domains)
          .set({ resendWebhookId: (webhook as any)?.id || null, updatedAt: new Date() })
          .where(eq(domains.id, domain.id))
          .returning();

        return updated;
      } catch (error) {
        console.error("[domain] Failed to create Resend webhook:", error);
        throw new Error("Failed to create Resend webhook");
      }
    }),

  delete: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(domains)
        .where(and(eq(domains.id, input.id), eq(domains.userId, ctx.user!.id)));

      return { success: true };
    }),

  // Admin: list all domains
  adminList: adminQuery
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

      const [domainList, countResult] = await Promise.all([
        db.query.domains.findMany({
          with: {
            user: {
              columns: {
                id: true,
                email: true,
                name: true,
              },
            },
            mailboxes: true,
          },
          orderBy: [sql`${domains.createdAt} desc`],
          limit: filters.pageSize,
          offset,
        }),
        db.select({ count: sql<number>`count(*)` }).from(domains),
      ]);

      return {
        domains: domainList,
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total: Number(countResult[0]?.count || 0),
          totalPages: Math.ceil(Number(countResult[0]?.count || 0) / filters.pageSize),
        },
      };
    }),
});
