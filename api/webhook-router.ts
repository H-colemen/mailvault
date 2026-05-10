import { z } from "zod";
import { sql } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { createAdminClient } from "./lib/supabase";
import { env } from "./lib/env";
// Inbound email webhook processing
import * as postalMime from "postal-mime";
import { Webhook } from "svix";

// Verify Resend webhook signature
function verifyResendWebhook(rawBody: string, headers: Record<string, string>, secret: string): boolean {
  try {
    const webhook = new Webhook(secret);
    return webhook.verify(rawBody, headers);
  } catch (error) {
    console.error("[webhook] Signature verification error:", error);
    return false;
  }
}

// Normalizes Resend inbound payload field names
function normalizeInboundPayload(input: Record<string, unknown>) {
  const data = (input["data"] && typeof input["data"] === "object")
    ? input["data"] as Record<string, unknown>
    : (input["message"] && typeof input["message"] === "object")
      ? input["message"] as Record<string, unknown>
      : input;

  const getString = (value: unknown) => (typeof value === "string" ? value : "");
  const getStringArray = (value: unknown) => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        if (typeof item === "string") return [item];
        if (item && typeof item === "object" && typeof (item as any).email === "string") return [(item as any).email];
        return [];
      });
    }
    if (typeof value === "string") return [value];
    return [];
  };

  const toList = getStringArray(data["to"] || data["recipient_to"] || (data["envelope"] && typeof data["envelope"] === "object" ? (data["envelope"] as any).to : undefined));
  const ccList = getStringArray(data["cc"] || data["recipient_cc"] || (data["envelope"] && typeof data["envelope"] === "object" ? (data["envelope"] as any).cc : undefined));
  const bccList = getStringArray(data["bcc"] || data["recipient_bcc"]);

  const fromValue = typeof data["from"] === "string"
    ? data["from"]
    : data["from"] && typeof data["from"] === "object"
      ? (data["from"] as any).email
      : undefined;

  return {
    from: getString(fromValue || data["sender"] || ""),
    to: toList,
    cc: ccList,
    bcc: bccList,
    subject: getString(data["subject"]),
    text: getString(data["text"] || data["plain_text"]),
    html: getString(data["html"]),
    raw: getString(data["raw"] || data["email"]),
    headers: (data["headers"] && typeof data["headers"] === "object") ? data["headers"] as Record<string, string> : {},
    attachments: Array.isArray(data["attachments"]) ? data["attachments"] : [],
    messageId: getString(data["message_id"] || data["messageId"] || (data["headers"] && typeof data["headers"] === "object" ? (data["headers"] as any)["message-id"] : "")),
    inReplyTo: getString(data["in_reply_to"] || data["inReplyTo"] || (data["headers"] && typeof data["headers"] === "object" ? (data["headers"] as any)["in-reply-to"] : "")),
    references: getString(data["references"] || data["References"] || ""),
  };
}

// Shared email processing function
async function processInboundEmail(input: Record<string, unknown>, provider: string = "unknown") {
  const startTime = Date.now();
  const supabase = createAdminClient();

  try {
    // Parse the email
    const normalizeRecipientList = (value: unknown) => {
      if (Array.isArray(value)) {
        return value.flatMap((item) => {
          if (typeof item === "string") return [item.toLowerCase()];
          if (item && typeof item === "object" && typeof (item as any).email === "string") return [(item as any).email.toLowerCase()];
          return [];
        });
      }
      if (typeof value === "string") return [value.toLowerCase()];
      return [];
    };

    const toValues = normalizeRecipientList(input.to);
    const toEmail = toValues[0] || "";
    const fromEmail = normalizeRecipientList(input.from)[0] || "";
    const toDomain = toEmail.split("@")[1];

    if (!toDomain) {
      return { success: false, error: "Invalid recipient email" };
    }

    // Find domain
    const { data: domainList } = await supabase
      .from("domains")
      .select("*")
      .eq("domain_name", toDomain);

    let domain = domainList?.[0];

    // If no exact match, try catch-all
    if (!domain) {
      return { success: false, error: "Domain not found" };
    }

    // Find mailbox
    let { data: mailboxList } = await supabase
      .from("mailboxes")
      .select("*")
      .eq("domain_id", domain.id)
      .eq("address", toEmail);

    let mailbox = mailboxList?.[0];

    // If no specific mailbox, try catch-all
    if (!mailbox) {
      const { data: catchAllList } = await supabase
        .from("mailboxes")
        .select("*")
        .eq("domain_id", domain.id)
        .eq("is_catch_all", true);

      mailbox = catchAllList?.[0];
    }

    if (!mailbox) {
      return { success: false, error: "Mailbox not found" };
    }

    if (!mailbox.active) {
      return { success: false, error: "Mailbox is inactive" };
    }

    // Parse email content
    let bodyText = String(input.text || "");
    let bodyHtml = String(input.html || "");
    let subject = String(input.subject || "(no subject)");
    let headers: Record<string, string> = {};
    
    if (input.headers && typeof input.headers === "object") {
      headers = input.headers as Record<string, string>;
    }
    
    let messageId = headers["message-id"] || String(input.messageId || input.message_id || `<${Date.now()}.${Math.random().toString(36).substring(2)}@${toDomain}>`);
    let inReplyTo = String(input.inReplyTo || input.in_reply_to || headers["in-reply-to"] || "") || null;
    let references: string[] = [];
    
    if (Array.isArray(input.references)) {
      references = input.references.map((ref) => String(ref));
    } else if (typeof input.references === "string") {
      references = input.references.split(/\s+/).filter(Boolean);
    } else if (headers["references"]) {
      references = headers["references"].split(/\s+/).filter(Boolean);
    }

    // If raw MIME is provided, parse it
    const raw = input.raw || input.email;
    const normalizedAttachments = Array.isArray(input.attachments) ? input.attachments : [];
    let attachments: any[] = [];

    if (raw && typeof raw === "string") {
      try {
        const parser = new postalMime.default();
        const parsed = await parser.parse(Buffer.from(raw, "base64"));
        bodyText = parsed.text || bodyText;
        bodyHtml = parsed.html || bodyHtml;
        subject = parsed.subject || subject;

        if (parsed.messageId) {
          messageId = parsed.messageId;
        }
        if (parsed.inReplyTo) {
          inReplyTo = parsed.inReplyTo;
        }
        if (parsed.references) {
          references = Array.isArray(parsed.references) ? parsed.references : [parsed.references];
        }

        if (parsed.attachments && parsed.attachments.length > 0) {
          attachments = parsed.attachments;
        }
      } catch (parseError) {
        console.error("[webhook] Failed to parse MIME:", parseError);
      }
    }

    if (attachments.length === 0 && normalizedAttachments.length > 0) {
      attachments = normalizedAttachments;
    }

    // Extract sender info
    const senderName = headers["from"] 
      ? headers["from"].replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "") 
      : "";

    // Handle threading
    let threadId = null;

    // Try to find existing thread
    if (inReplyTo) {
      const { data: parentEmail } = await supabase
        .from("emails")
        .select("thread_id")
        .eq("message_id", inReplyTo)
        .single();

      if (parentEmail?.thread_id) {
        threadId = parentEmail.thread_id;
      }
    }

    // If no thread found by in-reply-to, try subject matching
    if (!threadId) {
      const normalizedSubject = subject.replace(/^Re:\s*/i, "").trim();
      const { data: existingThread } = await supabase
        .from("email_threads")
        .select("id")
        .eq("subject_normalized", normalizedSubject)
        .eq("domain_id", domain.id)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .single();

      if (existingThread) {
        threadId = existingThread.id;
      }
    }

    // Create new thread if needed
    if (!threadId) {
      const { data: newThread } = await supabase
        .from("email_threads")
        .insert({
          user_id: domain.user_id,
          domain_id: domain.id,
          subject,
          subject_normalized: subject.replace(/^Re:\s*/i, "").trim(),
          participants: [fromEmail, toEmail],
        })
        .select()
        .single();

      threadId = newThread?.id || null;
    } else {
      // Update existing thread
      await supabase
        .from("email_threads")
        .update({
          last_message_at: new Date().toISOString(),
          message_count: sql`message_count + 1`,
          unread_count: sql`unread_count + 1`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", threadId);
    }

    // Store raw email in Supabase Storage if available
    let rawSourceKey = null;
    if (raw && typeof raw === "string") {
      try {
        const key = `raw-emails/${domain.user_id}/${Date.now()}-${messageId.replace(/[<>]/g, "")}.eml`;
        const { error: uploadError } = await supabase.storage
          .from("email-raw")
          .upload(key, Buffer.from(raw, "base64"), {
            contentType: "message/rfc822",
            upsert: false,
          });

        if (!uploadError) {
          rawSourceKey = key;
        }
      } catch (storageError) {
        console.error("[webhook] Failed to store raw email:", storageError);
      }
    }

    // Create email record
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .insert({
        mailbox_id: mailbox.id,
        user_id: domain.user_id,
        domain_id: domain.id,
        thread_id: threadId,
        sender_name: senderName || fromEmail,
        sender_email: fromEmail,
        recipient_to: toValues.map((email) => ({ email })),
        recipient_cc: normalizeRecipientList(input.cc).map((email) => ({ email })),
        recipient_bcc: normalizeRecipientList(input.bcc).map((email) => ({ email })),
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        body_preview: bodyText.substring(0, 500),
        message_id: messageId,
        in_reply_to: inReplyTo,
        references,
        headers: input.headers || {},
        raw_source_key: rawSourceKey,
        direction: "inbound",
        status: "active",
        is_read: false,
        is_draft: false,
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (emailError) {
      throw new Error(`Failed to create email: ${emailError.message}`);
    }

    // Process and store attachments
    if (attachments.length > 0) {
      for (const attachment of attachments) {
        try {
          const filename = String(attachment.filename || attachment.name || `attachment-${Date.now()}`);
          const safeFilename = filename.replace(/[\\/\\\\?%*:|"<>]/g, "_");
          const attachmentKey = `attachments/${domain.user_id}/${email.id}/${Date.now()}-${safeFilename}`;
          const attachmentContent = attachment.content instanceof Buffer
            ? attachment.content
            : typeof attachment.content === "string"
              ? Buffer.from(attachment.content, "base64")
              : Buffer.from(attachment.data || "", "base64");

          const { error: uploadError } = await supabase.storage
            .from("email-attachments")
            .upload(attachmentKey, attachmentContent, {
              contentType: String(attachment.contentType || attachment.mimeType || "application/octet-stream"),
              upsert: false,
            });

          if (!uploadError) {
            const publicUrl = supabase.storage.from("email-attachments").getPublicUrl(attachmentKey).data?.publicUrl || null;
            await supabase.from("attachments").insert({
              email_id: email.id,
              filename,
              content_type: String(attachment.contentType || attachment.mimeType || "application/octet-stream"),
              file_size: Number(attachment.size ?? attachment.length ?? attachmentContent.length),
              storage_key: attachmentKey,
              storage_url: publicUrl,
              content_id: attachment.contentId || attachment.content_id || null,
              is_inline: String(attachment.disposition || attachment.contentDisposition || "attachment").toLowerCase() === "inline",
            });
          } else {
            console.error("[webhook] Failed to upload attachment:", uploadError);
          }
        } catch (attachmentError) {
          console.error("[webhook] Failed to process attachment:", attachmentError);
        }
      }
    }

    // Log webhook
    await supabase.from("webhook_logs").insert({
      provider,
      event_type: "inbound_email",
      success: true,
      email_id: email?.id,
      payload: { from: fromEmail, to: toEmail, subject },
    });

    return {
      success: true,
      emailId: email?.id,
      threadId,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[webhook] Error processing inbound email:", error);

    // Log failed webhook
    try {
      await supabase.from("webhook_logs").insert({
        provider,
        event_type: "inbound_email",
        success: false,
        error_message: error instanceof Error ? error.message : "Unknown error",
        payload: input,
      });
    } catch {
      // Ignore logging errors
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal error",
    };
  }
}

export const webhookRouter = createRouter({
  receive: publicQuery
    .input(
      z.object({
        from: z.string().email(),
        to: z.string().email(),
        subject: z.string().optional(),
        text: z.string().optional(),
        html: z.string().optional(),
        headers: z.record(z.string(), z.string()).optional(),
        raw: z.string().optional(),
        dkim: z.enum(["pass", "fail", "none"]).optional(),
        spf: z.enum(["pass", "fail", "none"]).optional(),
        dmarc: z.enum(["pass", "fail", "none"]).optional(),
        envelope: z.object({
          from: z.string().optional(),
          to: z.array(z.string()).optional(),
        }).optional(),
      }).passthrough(),
    )
    .mutation(async ({ input }) => {
      return processInboundEmail(input as Record<string, unknown>, "generic");
    }),

  // Generic webhook endpoint for Cloudflare Email Routing (HTTP POST)
  cloudflare: publicQuery
    .input(z.object({}).passthrough())
    .mutation(async ({ input }) => {
      return processInboundEmail(input as Record<string, unknown>, "cloudflare");
    }),

  // Resend webhook for inbound email
  resend: publicQuery
    .input(z.object({ rawBody: z.string().optional() }).passthrough())
    .mutation(async ({ input, ctx }) => {
      const rawBody = typeof input.rawBody === "string" ? input.rawBody : JSON.stringify(input);
      const signatureHeaders: Record<string, string> = {
        "svix-signature": ctx.req.headers.get("svix-signature") || "",
        "svix-timestamp": ctx.req.headers.get("svix-timestamp") || "",
        "svix-id": ctx.req.headers.get("svix-id") || "",
      };

      if (!env.resendWebhookSecret) {
        console.error("[webhook] Missing webhook secret");
        return { success: false, error: "Unauthorized" };
      }

      if (!verifyResendWebhook(rawBody, signatureHeaders, env.resendWebhookSecret)) {
        console.error("[webhook] Invalid webhook signature");
        return { success: false, error: "Unauthorized" };
      }

      const normalizedInput = normalizeInboundPayload(input as Record<string, unknown>);
      normalizedInput.raw = normalizedInput.raw || rawBody;

      return processInboundEmail(normalizedInput, "resend");
    }),
});
