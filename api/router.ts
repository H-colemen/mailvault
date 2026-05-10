import { authRouter } from "./auth-router";
import { emailRouter } from "./email-router";
import { domainRouter } from "./domain-router";
import { mailboxRouter } from "./mailbox-router";
import { sendRouter } from "./send-router";
import { webhookRouter } from "./webhook-router";
import { settingsRouter } from "./settings-router";
import { adminRouter } from "./admin-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  email: emailRouter,
  domain: domainRouter,
  mailbox: mailboxRouter,
  send: sendRouter,
  webhook: webhookRouter,
  settings: settingsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
