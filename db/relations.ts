import { relations } from "drizzle-orm";
import {
  users,
  domains,
  mailboxes,
  emails,
  emailThreads,
  attachments,
  auditLogs,
  settings,
} from "./schema";

export const usersRelations = relations(users, ({ many, one }) => ({
  domains: many(domains),
  mailboxes: many(mailboxes),
  emails: many(emails),
  threads: many(emailThreads),
  settings: one(settings),
  auditLogs: many(auditLogs),
}));

export const domainsRelations = relations(domains, ({ one, many }) => ({
  user: one(users, {
    fields: [domains.userId],
    references: [users.id],
  }),
  mailboxes: many(mailboxes),
  emails: many(emails),
  threads: many(emailThreads),
}));

export const mailboxesRelations = relations(mailboxes, ({ one, many }) => ({
  domain: one(domains, {
    fields: [mailboxes.domainId],
    references: [domains.id],
  }),
  user: one(users, {
    fields: [mailboxes.userId],
    references: [users.id],
  }),
  emails: many(emails),
}));

export const emailThreadsRelations = relations(emailThreads, ({ one, many }) => ({
  user: one(users, {
    fields: [emailThreads.userId],
    references: [users.id],
  }),
  domain: one(domains, {
    fields: [emailThreads.domainId],
    references: [domains.id],
  }),
  emails: many(emails),
}));

export const emailsRelations = relations(emails, ({ one, many }) => ({
  mailbox: one(mailboxes, {
    fields: [emails.mailboxId],
    references: [mailboxes.id],
  }),
  user: one(users, {
    fields: [emails.userId],
    references: [users.id],
  }),
  domain: one(domains, {
    fields: [emails.domainId],
    references: [domains.id],
  }),
  thread: one(emailThreads, {
    fields: [emails.threadId],
    references: [emailThreads.id],
  }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  email: one(emails, {
    fields: [attachments.emailId],
    references: [emails.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, {
    fields: [settings.userId],
    references: [users.id],
  }),
}));
