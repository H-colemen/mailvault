import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uuid,
  bigint,
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const emailDirectionEnum = pgEnum("email_direction", ["inbound", "outbound"]);
export const emailStatusEnum = pgEnum("email_status", ["active", "archived", "spam", "trashed", "deleted"]);

// Users table - synced with Supabase Auth
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  avatar: text("avatar"),
  role: userRoleEnum("role").default("user").notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Domains table
export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  domainName: varchar("domain_name", { length: 255 }).notNull(),
  verified: boolean("verified").default(false).notNull(),
  verificationToken: varchar("verification_token", { length: 255 }),
  dkimConfigured: boolean("dkim_configured").default(false).notNull(),
  spfConfigured: boolean("spf_configured").default(false).notNull(),
  dmarcConfigured: boolean("dmarc_configured").default(false).notNull(),
  mxConfigured: boolean("mx_configured").default(false).notNull(),
  // Resend-specific fields
  resendDomainId: uuid("resend_domain_id"),
  resendWebhookId: varchar("resend_webhook_id", { length: 255 }),
  resendVerified: boolean("resend_verified").default(false).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("domain_name_idx").on(table.domainName),
  index("domain_user_idx").on(table.userId),
]);

export type Domain = typeof domains.$inferSelect;
export type InsertDomain = typeof domains.$inferInsert;

// Mailboxes / Addresses table
export const mailboxes = pgTable("mailboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: uuid("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  address: varchar("address", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  isCatchAll: boolean("is_catch_all").default(false).notNull(),
  isAlias: boolean("is_alias").default(false).notNull(),
  forwardTo: varchar("forward_to", { length: 320 }),
  autoReply: boolean("auto_reply").default(false).notNull(),
  autoReplyMessage: text("auto_reply_message"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("mailbox_address_idx").on(table.address),
  index("mailbox_domain_idx").on(table.domainId),
  index("mailbox_user_idx").on(table.userId),
]);

export type Mailbox = typeof mailboxes.$inferSelect;
export type InsertMailbox = typeof mailboxes.$inferInsert;

// Email Threads table
export const emailThreads = pgTable("email_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  domainId: uuid("domain_id").references(() => domains.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 1000 }),
  subjectNormalized: varchar("subject_normalized", { length: 1000 }),
  participants: jsonb("participants").$type<string[]>(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
  messageCount: integer("message_count").default(1).notNull(),
  unreadCount: integer("unread_count").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("thread_user_idx").on(table.userId),
  index("thread_domain_idx").on(table.domainId),
  index("thread_last_msg_idx").on(table.lastMessageAt),
]);

export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = typeof emailThreads.$inferInsert;

// Emails table
export const emails = pgTable("emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  mailboxId: uuid("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  domainId: uuid("domain_id").references(() => domains.id, { onDelete: "cascade" }),
  threadId: uuid("thread_id").references(() => emailThreads.id, { onDelete: "set null" }),
  
  // Sender/Recipient info
  senderName: varchar("sender_name", { length: 255 }),
  senderEmail: varchar("sender_email", { length: 320 }).notNull(),
  senderAvatar: text("sender_avatar"),
  recipientTo: jsonb("recipient_to").$type<{email: string; name?: string}[]>().notNull(),
  recipientCc: jsonb("recipient_cc").$type<{email: string; name?: string}[]>(),
  recipientBcc: jsonb("recipient_bcc").$type<{email: string; name?: string}[]>(),
  
  // Content
  subject: varchar("subject", { length: 1000 }),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  bodyPreview: varchar("body_preview", { length: 500 }),
  
  // Headers & Metadata
  messageId: varchar("message_id", { length: 500 }),
  inReplyTo: varchar("in_reply_to", { length: 500 }),
  references: jsonb("references").$type<string[]>(),
  headers: jsonb("headers").$type<Record<string, string>>(),
  
  // Raw source storage reference
  rawSourceKey: varchar("raw_source_key", { length: 500 }),
  
  // Status
  status: emailStatusEnum("status").default("active").notNull(),
  direction: emailDirectionEnum("direction").default("inbound").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  isStarred: boolean("is_starred").default(false).notNull(),
  isDraft: boolean("is_draft").default(false).notNull(),
  
  // Spam scoring
  spamScore: integer("spam_score"),
  spamReason: text("spam_reason"),
  
  // Timestamps
  sentAt: timestamp("sent_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("email_mailbox_idx").on(table.mailboxId),
  index("email_user_idx").on(table.userId),
  index("email_domain_idx").on(table.domainId),
  index("email_thread_idx").on(table.threadId),
  index("email_message_id_idx").on(table.messageId),
  index("email_sender_idx").on(table.senderEmail),
  index("email_status_idx").on(table.status),
  index("email_direction_idx").on(table.direction),
  index("email_received_idx").on(table.receivedAt),
  index("email_is_read_idx").on(table.isRead),
]);

export type Email = typeof emails.$inferSelect;
export type InsertEmail = typeof emails.$inferInsert;

// Attachments table
export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailId: uuid("email_id").notNull().references(() => emails.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 500 }).notNull(),
  contentType: varchar("content_type", { length: 255 }).notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  storageUrl: text("storage_url"),
  contentId: varchar("content_id", { length: 255 }),
  isInline: boolean("is_inline").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("attachment_email_idx").on(table.emailId),
]);

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;

// Webhook Logs table
export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: varchar("provider", { length: 100 }).notNull(),
  eventType: varchar("event_type", { length: 100 }),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("error_message"),
  payload: jsonb("payload"),
  emailId: uuid("email_id").references(() => emails.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = typeof webhookLogs.$inferInsert;

// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 255 }).notNull(),
  resource: varchar("resource", { length: 255 }),
  resourceId: varchar("resource_id", { length: 255 }),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// Settings table
export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  theme: varchar("theme", { length: 50 }).default("system").notNull(),
  language: varchar("language", { length: 10 }).default("en").notNull(),
  timezone: varchar("timezone", { length: 100 }).default("UTC").notNull(),
  dateFormat: varchar("date_format", { length: 50 }).default("MMM d, yyyy").notNull(),
  autoRefresh: integer("auto_refresh").default(30),
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  soundEnabled: boolean("sound_enabled").default(false).notNull(),
  signature: text("signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;
