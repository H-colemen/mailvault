import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { emails, emailThreads, mailboxes, domains } from "@db/schema";
import { env } from "./lib/env";

export const sendRouter = createRouter({
  // Send a new email
  send: authedQuery
    .input(
      z.object({
        from: z.string().email(),
        to: z.array(z.object({ email: z.string().email(), name: z.string().optional() })),
        cc: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).optional(),
        bcc: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).optional(),
        subject: z.string().max(1000),
        bodyText: z.string(),
        bodyHtml: z.string().optional(),
        replyTo: z.string().email().optional(),
        threadId: z.string().uuid().optional(),
        inReplyTo: z.string().optional(),
        references: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user!.id;

      // Find the mailbox for the from address
      const fromDomain = input.from.split("@")[1];
      const domain = await db.query.domains.findFirst({
        where: and(
          eq(domains.domainName, fromDomain),
          eq(domains.userId, userId),
        ),
      });

      if (!domain) {
        throw new Error("You do not own the domain for this sender address");
      }

      let mailbox = await db.query.mailboxes.findFirst({
        where: and(
          eq(mailboxes.domainId, domain.id),
          eq(mailboxes.userId, userId),
          eq(mailboxes.address, input.from),
        ),
      });

      if (!mailbox) {
        mailbox = await db.query.mailboxes.findFirst({
          where: and(
            eq(mailboxes.domainId, domain.id),
            eq(mailboxes.userId, userId),
            eq(mailboxes.isCatchAll, true),
          ),
        });
      }

      if (!mailbox) {
        throw new Error("No mailbox configured for this sender address");
      }

      // Generate message ID
      const messageId = `<${Date.now()}-${Math.random().toString(36).substring(2)}@${fromDomain}>`;

      // Handle threading
      let threadId = input.threadId;
      if (!threadId && input.inReplyTo) {
        // Find existing thread
        const existingEmail = await db.query.emails.findFirst({
          where: eq(emails.messageId, input.inReplyTo),
        });
        if (existingEmail?.threadId) {
          threadId = existingEmail.threadId;
        }
      }

      if (!threadId) {
        // Create new thread
        const [thread] = await db
          .insert(emailThreads)
          .values({
            userId,
            domainId: domain.id,
            subject: input.subject,
            subjectNormalized: input.subject.replace(/^Re:\s*/i, ""),
            participants: [
              input.from,
              ...input.to.map((t) => t.email),
              ...(input.cc?.map((c) => c.email) || []),
            ],
          })
          .returning();
        threadId = thread.id;
      } else {
        // Update existing thread
        await db
          .update(emailThreads)
          .set({
            lastMessageAt: new Date(),
            messageCount: sql`${emailThreads.messageCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(emailThreads.id, threadId));
      }

      // Store the sent email
      const [email] = await db
        .insert(emails)
        .values({
          mailboxId: mailbox?.id,
          userId,
          domainId: domain.id,
          threadId,
          senderName: ctx.user!.name || ctx.user!.email,
          senderEmail: input.from,
          recipientTo: input.to,
          recipientCc: input.cc || [],
          recipientBcc: input.bcc || [],
          subject: input.subject,
          bodyText: input.bodyText,
          bodyHtml: input.bodyHtml || input.bodyText,
          bodyPreview: input.bodyText.substring(0, 500),
          messageId,
          inReplyTo: input.inReplyTo || null,
          references: input.references || [],
          direction: "outbound",
          status: "active",
          isRead: true,
          isDraft: false,
          sentAt: new Date(),
          receivedAt: new Date(),
        })
        .returning();

      // Send via Resend if API key is configured
      if (env.resendApiKey) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(env.resendApiKey);

          await resend.emails.send({
            from: input.from,
            to: input.to.map((t) => t.email),
            cc: input.cc?.map((c) => c.email),
            bcc: input.bcc?.map((b) => b.email),
            subject: input.subject,
            text: input.bodyText,
            html: input.bodyHtml,
            replyTo: input.replyTo,
            headers: {
              "Message-ID": messageId,
              ...(input.inReplyTo ? { "In-Reply-To": input.inReplyTo } : {}),
              ...(input.references?.length ? { References: input.references.join(" ") } : {}),
            },
          });
        } catch (error) {
          console.error("[send] Failed to send via Resend:", error);
          // Don't throw - we still saved the email in our database
        }
      }

      return email;
    }),

  // Save draft
  saveDraft: authedQuery
    .input(
      z.object({
        id: z.string().uuid().optional(),
        from: z.string().email().optional(),
        to: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).optional(),
        cc: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).optional(),
        subject: z.string().max(1000).optional(),
        bodyText: z.string().optional(),
        bodyHtml: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user!.id;

      if (input.id) {
        // Update existing draft
        const [email] = await db
          .update(emails)
          .set({
            senderEmail: input.from || ctx.user!.email,
            recipientTo: input.to || [],
            recipientCc: input.cc || [],
            subject: input.subject || null,
            bodyText: input.bodyText || null,
            bodyHtml: input.bodyHtml || null,
            bodyPreview: input.bodyText?.substring(0, 500) || null,
            updatedAt: new Date(),
          })
          .where(and(eq(emails.id, input.id), eq(emails.userId, userId), eq(emails.isDraft, true)))
          .returning();

        return email;
      } else {
        // Create new draft
        const [email] = await db
          .insert(emails)
          .values({
            userId,
            senderEmail: input.from || ctx.user!.email,
            recipientTo: input.to || [],
            recipientCc: input.cc || [],
            subject: input.subject || null,
            bodyText: input.bodyText || null,
            bodyHtml: input.bodyHtml || null,
            bodyPreview: input.bodyText?.substring(0, 500) || null,
            direction: "outbound",
            status: "active",
            isDraft: true,
            isRead: true,
          })
          .returning();

        return email;
      }
    }),

  // Delete draft
  deleteDraft: authedQuery
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(emails)
        .where(and(eq(emails.id, input.id), eq(emails.userId, ctx.user!.id), eq(emails.isDraft, true)));

      return { success: true };
    }),

  // Reply to email
  reply: authedQuery
    .input(
      z.object({
        emailId: z.string().uuid(),
        bodyText: z.string(),
        bodyHtml: z.string().optional(),
        replyAll: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user!.id;

      const originalEmail = await db.query.emails.findFirst({
        where: and(eq(emails.id, input.emailId), eq(emails.userId, userId)),
      });

      if (!originalEmail) {
        throw new Error("Original email not found");
      }

      // Build recipient list
      const to = [{ email: originalEmail.senderEmail, name: originalEmail.senderName || undefined }];
      let cc: { email: string; name?: string }[] = [];

      if (input.replyAll && originalEmail.recipientCc) {
        cc = originalEmail.recipientCc.filter(
          (c) => c.email !== ctx.user!.email,
        );
      }

      // Get from address from the original recipient
      const fromEmail = originalEmail.recipientTo[0]?.email || ctx.user!.email;

      // Generate subject
      const subject = originalEmail.subject?.startsWith("Re:")
        ? originalEmail.subject
        : `Re: ${originalEmail.subject}`;

      // Use the send mutation logic
      const domain = await db.query.domains.findFirst({
        where: and(
          eq(domains.domainName, fromEmail.split("@")[1]),
          eq(domains.userId, userId),
        ),
      });

      if (!domain) {
        throw new Error("You do not own the domain for this sender address");
      }

      let mailbox = await db.query.mailboxes.findFirst({
        where: and(
          eq(mailboxes.domainId, domain.id),
          eq(mailboxes.userId, userId),
          eq(mailboxes.address, fromEmail),
        ),
      });

      if (!mailbox) {
        mailbox = await db.query.mailboxes.findFirst({
          where: and(
            eq(mailboxes.domainId, domain.id),
            eq(mailboxes.userId, userId),
            eq(mailboxes.isCatchAll, true),
          ),
        });
      }

      if (!mailbox) {
        throw new Error("No mailbox configured for this sender address");
      }

      const messageId = `<${Date.now()}-${Math.random().toString(36).substring(2)}@${domain.domainName}>`;

      let threadId = originalEmail.threadId;
      if (!threadId) {
        const [thread] = await db
          .insert(emailThreads)
          .values({
            userId,
            domainId: domain.id,
            subject: originalEmail.subject,
            subjectNormalized: originalEmail.subject?.replace(/^Re:\s*/i, ""),
            participants: [fromEmail, originalEmail.senderEmail],
          })
          .returning();
        threadId = thread.id;

        // Update original email with thread ID
        await db
          .update(emails)
          .set({ threadId })
          .where(eq(emails.id, originalEmail.id));
      }

      await db
        .update(emailThreads)
        .set({
          lastMessageAt: new Date(),
          messageCount: sql`${emailThreads.messageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(emailThreads.id, threadId));

      const [email] = await db
        .insert(emails)
        .values({
          mailboxId: mailbox?.id,
          userId,
          domainId: domain.id,
          threadId,
          senderName: ctx.user!.name || ctx.user!.email,
          senderEmail: fromEmail,
          recipientTo: to,
          recipientCc: cc,
          subject,
          bodyText: input.bodyText,
          bodyHtml: input.bodyHtml || input.bodyText,
          bodyPreview: input.bodyText.substring(0, 500),
          messageId,
          inReplyTo: originalEmail.messageId,
          references: [
            ...(originalEmail.references || []),
            originalEmail.messageId,
          ].filter(Boolean) as string[],
          direction: "outbound",
          status: "active",
          isRead: true,
          isDraft: false,
          sentAt: new Date(),
          receivedAt: new Date(),
        })
        .returning();

      // Send via Resend
      if (env.resendApiKey) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(env.resendApiKey);

          await resend.emails.send({
            from: fromEmail,
            to: to.map((t) => t.email),
            cc: cc.map((c) => c.email),
            subject,
            text: input.bodyText,
            html: input.bodyHtml,
            headers: {
              "Message-ID": messageId,
              "In-Reply-To": originalEmail.messageId || "",
              References: [
                ...(originalEmail.references || []),
                originalEmail.messageId,
              ]
                .filter(Boolean)
                .join(" "),
            },
          });
        } catch (error) {
          console.error("[reply] Failed to send via Resend:", error);
        }
      }

      return email;
    }),
});
