# RevLine — Architecture Review Brief

## What This Is

I built RevLine solo. It's a multi-tenant RevOps platform that acts as an orchestration layer between outreach channels and inbound funnels for businesses. Think a more opinionated Zapier/Make/n8n — except I'm not building a general-purpose automation tool. I'm building the system that lets me stand up, monitor, and operate full lead capture and follow-up pipelines for clients without human capital.

A business signs up, I configure their integrations (MailerLite, Stripe, Calendly, Twilio, ABC Ignite, etc.), wire up workflows, and from that point forward the system handles capture, routing, messaging, and booking autonomously. Every action is logged. Every failure is visible. I can pause a client's entire pipeline with one click.

The platform is live, running on Railway, serving real clients.

---

## How It's Built

Next.js 16 monolith with Postgres via Prisma. Everything lives in one repo — API routes, dashboard, landing pages, the works.

The core idea is **nothing knows about anything**. Leads can come from anywhere — a landing page form, a Stripe checkout, a Calendly booking, an inbound SMS, a gym membership sync. And the system can respond through any channel — email, SMS, API call, AI conversation. The pieces don't know about each other. They just register what they can do, and the workflow engine connects them.

There are three major subsystems:

**Workflow Engine** — The central automation layer. Every integration registers its own triggers and actions into an adapter registry. Workflows are configured per-workspace: "when Stripe payment succeeds, create a lead, add them to a MailerLite group, send a welcome email via Resend." 11 adapters, 9 action executors. Trigger, filter, execute sequentially, log the result.

**Agent Engine** — AI-powered conversational agents. Currently SMS via Twilio, backed by OpenAI or Anthropic. An agent gets a system prompt, guardrails (message limits, token budgets, timeout, escalation patterns), and a tool registry. Inbound SMS hits the Twilio webhook, finds or creates a conversation, runs the AI loop, sends the reply. This is where I'm investing the most going forward.

**Adapters and Registries** — Every external service (MailerLite, Stripe, Calendly, ABC Ignite, Resend, Twilio, OpenAI, Anthropic) has an adapter class that extends a base. Every adapter in the workflow registry declares its triggers, actions, required secrets, and parameter schemas. The idea is that adding a new integration is a matter of writing an adapter and registering it — not rewiring the app.

Supporting all of this:

- **Encrypted secrets** — AES-256-GCM with a versioned keyring. Multiple named secrets per integration. Decrypted only at point-of-use, never logged, never returned in responses.
- **Event logging** — Append-only event ledger. Every state transition, every integration outcome, every execution block. This is the primary debugging surface.
- **Reliability layer** — Webhook deduplication via raw payload storage, idempotent action execution, correlation IDs linking webhooks to workflow executions.
- **Multi-user auth** — Email + password (Argon2id), optional TOTP 2FA, organizations, workspace roles (Owner/Admin/Member/Viewer).

---

## What I Think Is Working

The adapter pattern. The fact that I can add a new integration — define its adapter, register its triggers and actions, write the executor — and the workflow engine, the dashboard, and the testing UI all pick it up automatically. That pattern has held up well from 4 integrations to 10.

The event system as the single debugging surface. When something breaks, I don't dig through logs. I look at the events table, filtered by workspace. Every meaningful thing that happens emits an event. That discipline has saved me more than once.

Per-workspace isolation. Secrets are scoped, events are scoped, workflows are scoped. There's no way for workspace A's data to leak into workspace B's pipeline. The database enforces it.

The workflow engine's decoupled design. Clients can have completely different automation pipelines without code changes. One client might be Stripe + MailerLite + Resend. Another might be ABC Ignite + Twilio + an AI agent. Same engine, different configuration.

---

## What I Don't Know

I'm not syntax-literate in the traditional sense. I built this with AI assistance, and while I understand the architecture, the patterns, and the "why" behind every decision — I can't always be certain the "how" is implemented correctly under the hood.

My specific fears:

- **Am I shipping subtle bugs I can't see?** — Logic errors, race conditions, edge cases in async flows. The kind of thing that works in testing but fails at 2am when a webhook payload is slightly different than expected.
- **Does my reliability layer actually work?** — I built webhook deduplication, idempotent execution, and correlation tracking. But I built it to solve problems I've read about, not problems I've personally debugged in production at scale. I don't know if there are gaps.
- **Is the agent system architected for where I want to take it?** — I'm going deeper on AI agents. More channels, more tools, more autonomous behavior. Is the current engine/conversation/tool-registry structure going to support that, or am I building on a foundation that'll need to be ripped out?
- **Security blind spots.** — I'm handling encryption, webhook signature verification, rate limiting, auth. But security is the domain where "it works" doesn't mean "it's safe." I want someone who knows this space to look at my crypto implementation, my auth flow, my secret handling.
- **Code quality I can't evaluate.** — Are my abstractions right? Is there unnecessary complexity? Am I over-engineering some things and under-engineering others? I don't have the experience to benchmark my own patterns.

---

## What I Want You to Look At

### Overall Architecture

Is a Next.js monolith the right call for this? Everything — API, dashboard, webhooks, cron jobs, landing pages — lives in one app. It's simple to deploy and reason about, but I want to know where the walls are.

### Workflow Engine

Is the adapter registry + sequential executor pattern solid? Am I going to run into issues with the current trigger-filter-execute model as workflows get more complex? Look at `app/_lib/workflow/`.

### Agent Engine

This is where I'm going next. Is the engine/conversation/tool-registry structure extensible? Can it support multiple channels, longer-running conversations, more sophisticated tool use? Look at `app/_lib/agent/`.

### Reliability

Webhook processor, idempotent executor, correlation IDs. Is this actually protecting me, or is it theater? Look at `app/_lib/reliability/`.

### Security

Secrets encryption (keyring, AES-256-GCM), auth flow (Argon2id, sessions, 2FA), webhook signature verification, rate limiting. Are there holes? Look at `app/_lib/crypto.ts`, `app/_lib/auth.ts`, `proxy.ts`.

### Code Quality

Patterns, abstractions, naming, file organization. Am I doing things that will make this harder to maintain or hand off? Look at anything — I want the honest take.

### Scaling

I'm not at 100 clients. I'm at a handful. But I want to know what's going to break first when I grow. Database, connection pooling, event table growth, webhook processing throughput — where are the pressure points?

---

## Where to Look

The repo is organized around the Next.js App Router. Here's the map:

- **`app/_lib/workflow/`** — Workflow engine (registry, engine, executors, types)
- **`app/_lib/agent/`** — AI agent engine (engine, adapters, tools, escalation)
- **`app/_lib/integrations/`** — 10 integration adapters (base class + per-service)
- **`app/_lib/reliability/`** — Webhook processor, idempotent executor
- **`app/_lib/crypto.ts`** — AES-256-GCM encryption with versioned keyring
- **`app/_lib/auth.ts`** — Argon2id auth, sessions, cookie management
- **`app/_lib/client-gate.ts`** — Workspace lookup + execution gating
- **`app/_lib/event-logger.ts`** — Event emission
- **`app/api/v1/`** — All API routes (66+ endpoints)
- **`prisma/schema.prisma`** — Database schema (~20 models)
- **`proxy.ts`** — Next.js 16 proxy (replaces middleware.ts), global rate limiting
- **`docs/ARCHITECTURE.md`** — Full system documentation (recently updated)
- **`docs/STANDARDS.md`** — Coding standards and conventions

---

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- PostgreSQL via Prisma ORM
- Tailwind CSS v4
- Railway (Docker deployment)
- Sentry for error tracking
- GitHub Actions CI (lint, type-check, test, build)
