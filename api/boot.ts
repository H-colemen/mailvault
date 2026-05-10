import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

// Increase body limit for email attachments (50MB)
app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// Direct webhook endpoint for Cloudflare Email Routing
app.post("/api/webhooks/cloudflare", async (c) => {
  try {
    const body = await c.req.json();
    
    // Call the tRPC webhook router through the request handler
    const fakeReq = new Request("http://localhost/api/trpc/webhook.cloudflare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await appRouter.createCaller({
      req: fakeReq,
      resHeaders: new Headers(),
    }).webhook.cloudflare(body);

    return c.json(result);
  } catch (error) {
    console.error("[webhook] Cloudflare webhook error:", error);
    return c.json({ success: false, error: "Webhook processing failed" }, 500);
  }
});

// Resend webhook endpoint
app.post("/api/webhooks/resend", async (c) => {
  try {
    const rawBody = await c.req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    const result = await appRouter.createCaller({
      req: c.req.raw,
      resHeaders: new Headers(),
    }).webhook.resend({ ...body, rawBody });

    return c.json(result);
  } catch (error) {
    console.error("[webhook] Resend webhook error:", error);
    return c.json({ success: false, error: "Webhook processing failed" }, 500);
  }
});

// tRPC API endpoint
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

// 404 handler
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
