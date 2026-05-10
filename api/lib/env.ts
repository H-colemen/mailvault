import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  kimiAuthUrl: required("KIMI_AUTH_URL"),
  kimiOpenUrl: required("KIMI_OPEN_URL"),
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
  
  // Supabase
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseDatabaseUrl: process.env.SUPABASE_DATABASE_URL ?? "",
  
  // Email sending
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  
  // Webhook
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
};
