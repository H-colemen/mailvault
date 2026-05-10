# MailVault - Custom Email Platform

A complete, modern email platform that turns your domain into a fully functional mailbox without traditional email hosting. Built with React, tRPC, Drizzle ORM, and Supabase.

## Architecture Overview

```
Sender --> Your Domain --> Cloudflare Email Routing --> Webhook --> Your Backend --> Supabase DB
                                                                             --> Supabase Storage (attachments)
                                                           --> tRPC API --> React Frontend
```

## Features

### Core Email Features
- **Custom Email Addresses**: Create unlimited email addresses on your domain (hello@yourdomain.com, support@yourdomain.com, etc.)
- **Catch-All Addresses**: Receive emails sent to any address @yourdomain.com
- **Inbox Management**: Read, star, archive, trash, and mark emails as spam
- **Compose & Reply**: Send emails and reply to incoming messages
- **Drafts**: Save email drafts and send later
- **Threaded Conversations**: Emails are grouped into conversation threads
- **Search**: Full-text search across sender, subject, and body
- **Bulk Actions**: Select multiple emails and perform actions
- **Responsive Design**: Works on desktop and mobile

### Domain & Mailbox Management
- **Multiple Domains**: Add and manage multiple custom domains
- **DNS Configuration**: Built-in DNS record guidance for MX, SPF, DKIM, DMARC
- **Mailbox Aliases**: Create aliases with forwarding
- **Catch-All Setup**: Configure catch-all addresses per domain

### Admin Features
- **Admin Dashboard**: View system statistics and health
- **User Management**: Manage registered users
- **Webhook Logs**: Monitor inbound email processing
- **Audit Logs**: Track system activity

### Technical
- **Supabase Auth**: Secure authentication with email/password
- **Role-Based Access**: Admin and user roles
- **Dark Mode**: System-aware dark/light theme
- **Real-time Stats**: Auto-refreshing email counts

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Hono, tRPC 11, Drizzle ORM
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (for attachments and raw emails)
- **Email Sending**: Resend API
- **Email Receiving**: Cloudflare Email Routing webhooks

## Prerequisites

1. A domain name (through Spaceship, Namecheap, Cloudflare, etc.)
2. A Supabase account (free tier works)
3. A Cloudflare account for DNS and email routing
4. (Optional) A Resend account for sending emails

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Get your project URL and anon key from Project Settings > API
3. Get your database password from Project Settings > Database
4. Construct your database connection string:
   ```
   postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
   ```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Optional: for sending emails
RESEND_API_KEY=re_your_resend_api_key

# Optional: for webhook verification
WEBHOOK_SECRET=your-webhook-secret
```

### 3. Database Setup

Run the following SQL in your Supabase SQL Editor (Dashboard → SQL Editor → New Query):

**Migration 1: Create all tables**

```sql
CREATE TYPE "public"."email_direction" AS ENUM('inbound', 'outbound');
CREATE TYPE "public"."email_status" AS ENUM('active', 'archived', 'spam', 'trashed', 'deleted');
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(255),
	"avatar" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain_name" varchar(255) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verification_token" varchar(255),
	"dkim_configured" boolean DEFAULT false NOT NULL,
	"spf_configured" boolean DEFAULT false NOT NULL,
	"dmarc_configured" boolean DEFAULT false NOT NULL,
	"mx_configured" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "mailboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"address" varchar(320) NOT NULL,
	"name" varchar(255),
	"is_catch_all" boolean DEFAULT false NOT NULL,
	"is_alias" boolean DEFAULT false NOT NULL,
	"forward_to" varchar(320),
	"auto_reply" boolean DEFAULT false NOT NULL,
	"auto_reply_message" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "email_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain_id" uuid,
	"subject" varchar(1000),
	"subject_normalized" varchar(1000),
	"participants" jsonb,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_count" integer DEFAULT 1 NOT NULL,
	"unread_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mailbox_id" uuid,
	"user_id" uuid NOT NULL,
	"domain_id" uuid,
	"thread_id" uuid,
	"sender_name" varchar(255),
	"sender_email" varchar(320) NOT NULL,
	"sender_avatar" text,
	"recipient_to" jsonb NOT NULL,
	"recipient_cc" jsonb,
	"recipient_bcc" jsonb,
	"subject" varchar(1000),
	"body_text" text,
	"body_html" text,
	"body_preview" varchar(500),
	"message_id" varchar(500),
	"in_reply_to" varchar(500),
	"references" jsonb,
	"headers" jsonb,
	"raw_source_key" varchar(500),
	"status" "email_status" DEFAULT 'active' NOT NULL,
	"direction" "email_direction" DEFAULT 'inbound' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"spam_score" integer,
	"spam_reason" text,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"filename" varchar(500) NOT NULL,
	"content_type" varchar(255) NOT NULL,
	"file_size" bigint NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"storage_url" text,
	"content_id" varchar(255),
	"is_inline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"theme" varchar(50) DEFAULT 'system' NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"date_format" varchar(50) DEFAULT 'MMM d, yyyy' NOT NULL,
	"auto_refresh" integer DEFAULT 30,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"sound_enabled" boolean DEFAULT false NOT NULL,
	"signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(100) NOT NULL,
	"event_type" varchar(100),
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"payload" jsonb,
	"email_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(255) NOT NULL,
	"resource" varchar(255),
	"resource_id" varchar(255),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign Keys
ALTER TABLE "domains" ADD CONSTRAINT "domains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade;
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade;
ALTER TABLE "emails" ADD CONSTRAINT "emails_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE set null;
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
ALTER TABLE "emails" ADD CONSTRAINT "emails_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade;
ALTER TABLE "emails" ADD CONSTRAINT "emails_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE set null;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade;
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null;
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE no action;

-- Indexes
CREATE INDEX "domain_name_idx" ON "domains" USING btree ("domain_name");
CREATE INDEX "domain_user_idx" ON "domains" USING btree ("user_id");
CREATE INDEX "mailbox_address_idx" ON "mailboxes" USING btree ("address");
CREATE INDEX "mailbox_domain_idx" ON "mailboxes" USING btree ("domain_id");
CREATE INDEX "mailbox_user_idx" ON "mailboxes" USING btree ("user_id");
CREATE INDEX "thread_user_idx" ON "email_threads" USING btree ("user_id");
CREATE INDEX "thread_domain_idx" ON "email_threads" USING btree ("domain_id");
CREATE INDEX "thread_last_msg_idx" ON "email_threads" USING btree ("last_message_at");
CREATE INDEX "email_mailbox_idx" ON "emails" USING btree ("mailbox_id");
CREATE INDEX "email_user_idx" ON "emails" USING btree ("user_id");
CREATE INDEX "email_domain_idx" ON "emails" USING btree ("domain_id");
CREATE INDEX "email_thread_idx" ON "emails" USING btree ("thread_id");
CREATE INDEX "email_message_id_idx" ON "emails" USING btree ("message_id");
CREATE INDEX "email_sender_idx" ON "emails" USING btree ("sender_email");
CREATE INDEX "email_status_idx" ON "emails" USING btree ("status");
CREATE INDEX "email_direction_idx" ON "emails" USING btree ("direction");
CREATE INDEX "email_received_idx" ON "emails" USING btree ("received_at");
CREATE INDEX "email_is_read_idx" ON "emails" USING btree ("is_read");
CREATE INDEX "attachment_email_idx" ON "attachments" USING btree ("email_id");
```

**Migration 2: Add Resend fields to domains table**

After running Migration 1, create a new query and run:

```sql
ALTER TABLE "domains" ADD COLUMN "resend_domain_id" varchar(255);
ALTER TABLE "domains" ADD COLUMN "resend_webhook_id" varchar(255);
ALTER TABLE "domains" ADD COLUMN "resend_verified" boolean DEFAULT false NOT NULL;
```

### 4. Cloudflare Email Routing Setup

1. Add your domain to Cloudflare
2. Go to Email > Email Routing
3. Enable Email Routing
4. Add a catch-all rule that forwards to your webhook:
   - Destination: `https://your-app.com/api/webhooks/cloudflare`
5. Add these DNS records:

**MX Record:**
- Type: MX
- Name: @
- Priority: 10
- Value: route1.mx.cloudflare.net

**SPF Record:**
- Type: TXT
- Name: @
- Value: v=spf1 include:_spf.cloudflare.net ~all

**DMARC Record:**
- Type: TXT
- Name: _dmarc
- Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com

### 5. Running Locally

```bash
npm install
npm run dev
```

The app will be available at http://localhost:3000

### 6. Production Deployment

Build the project:
```bash
npm run build
```

The build output is in `dist/`:
- `dist/public/` - Frontend static files
- `dist/boot.js` - Backend server

#### Deploy to Vercel (Frontend + Backend)

1. Push your code to GitHub
2. Create a new project on Vercel
3. Set the environment variables in Vercel's dashboard
4. Deploy

#### Deploy to Railway/Render/Fly.io (Backend)

1. Create a new project
2. Set the environment variables
3. Set the start command: `node dist/boot.js`
4. Deploy

## How Email Flow Works

### Receiving Emails

1. Someone sends an email to `anything@yourdomain.com`
2. Cloudflare receives the email via MX records
3. Cloudflare forwards the email to your webhook endpoint (`/api/webhooks/cloudflare`)
4. Your backend parses the email (MIME parsing via postal-mime)
5. The email is stored in Supabase PostgreSQL
6. If there's a matching thread, the email is added to it
7. The email appears in your inbox

### Sending Emails

1. You compose an email in the MailVault UI
2. Your backend stores the email as "outbound" in the database
3. If Resend API key is configured, the email is sent via Resend
4. The sent email appears in your Sent folder

### Catch-All Addresses

1. When you add a domain, a catch-all mailbox is automatically created
2. Any email sent to any address @yourdomain.com will be received
3. The system matches the exact address first, then falls back to catch-all
4. You can create specific mailboxes (e.g., `hello@yourdomain.com`) for dedicated addresses

## API Documentation

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `auth.me` | Query | Get current user |
| `auth.register` | Mutation | Register new account |
| `auth.login` | Mutation | Login with email/password |
| `auth.logout` | Mutation | Logout current user |

### Email Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `email.list` | Query | List emails with filters |
| `email.get` | Query | Get single email by ID |
| `email.markRead` | Mutation | Mark email as read/unread |
| `email.toggleStar` | Mutation | Toggle star status |
| `email.archive` | Mutation | Archive email |
| `email.unarchive` | Mutation | Unarchive email |
| `email.trash` | Mutation | Move to trash |
| `email.restore` | Mutation | Restore from trash |
| `email.markSpam` | Mutation | Mark as spam |
| `email.notSpam` | Mutation | Mark as not spam |
| `email.bulkAction` | Mutation | Bulk actions on emails |
| `email.stats` | Query | Get inbox statistics |
| `email.search` | Query | Search emails |

### Domain Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `domain.list` | Query | List all domains |
| `domain.get` | Query | Get domain by ID |
| `domain.create` | Mutation | Add new domain |
| `domain.verify` | Mutation | Verify domain DNS |
| `domain.delete` | Mutation | Delete domain |

### Mailbox Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `mailbox.list` | Query | List mailboxes |
| `mailbox.get` | Query | Get mailbox by ID |
| `mailbox.create` | Mutation | Create mailbox |
| `mailbox.update` | Mutation | Update mailbox |
| `mailbox.delete` | Mutation | Delete mailbox |
| `mailbox.toggleActive` | Mutation | Toggle active status |

### Send Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `send.send` | Mutation | Send new email |
| `send.saveDraft` | Mutation | Save draft |
| `send.deleteDraft` | Mutation | Delete draft |
| `send.reply` | Mutation | Reply to email |

### Webhook Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `webhook.receive` | Mutation | Process inbound email |
| `webhook.cloudflare` | Mutation | Cloudflare webhook |
| `webhook.resend` | Mutation | Resend webhook |

### Settings Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `settings.get` | Query | Get user settings |
| `settings.update` | Mutation | Update settings |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `admin.stats` | Query | Dashboard statistics |
| `admin.users` | Query | List all users |
| `admin.updateUser` | Mutation | Update user role |
| `admin.webhookLogs` | Query | View webhook logs |
| `admin.auditLogs` | Query | View audit logs |
| `admin.health` | Query | System health check |

## Project Structure

```
.
├── api/                    # Backend code
│   ├── boot.ts            # Hono server entry
│   ├── router.ts          # tRPC router
│   ├── middleware.ts      # tRPC procedures (public, authed, admin)
│   ├── context.ts         # tRPC context builder
│   ├── auth-router.ts     # Authentication router
│   ├── email-router.ts    # Email CRUD router
│   ├── domain-router.ts   # Domain management router
│   ├── mailbox-router.ts  # Mailbox/alias router
│   ├── send-router.ts     # Email sending router
│   ├── webhook-router.ts  # Inbound email webhook router
│   ├── settings-router.ts # User settings router
│   ├── admin-router.ts    # Admin dashboard router
│   ├── lib/
│   │   ├── env.ts        # Environment variables
│   │   ├── supabase.ts   # Supabase clients
│   │   └── cookies.ts    # Cookie utilities
│   ├── queries/
│   │   ├── connection.ts # Database connection
│   │   └── users.ts      # User queries
│   └── supabase/
│       └── auth.ts       # Supabase auth helpers
├── contracts/             # Shared types/constants
├── db/                    # Database schema
│   ├── schema.ts          # Table definitions
│   └── relations.ts       # Table relationships
├── src/                   # Frontend code
│   ├── pages/            # Route pages
│   ├── components/       # UI components
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utilities
│   ├── providers/        # Context providers
│   ├── App.tsx           # Routes
│   └── main.tsx          # Entry point
└── dist/                 # Build output
```

## Future Enhancements

- AI-powered email summaries
- Auto-replies
- Advanced spam detection
- Team inboxes (multiple users per domain)
- Labels and tags
- Calendar integration
- IMAP support for external email clients
- Mobile app (React Native)
- Disposable/temporary aliases
- Rich text compose editor
- PWA support with offline caching
- End-to-end encryption

## License

MIT License

## Support

For issues, questions, or contributions, please open an issue or pull request.
