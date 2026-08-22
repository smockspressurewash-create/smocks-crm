// alfredSmsAgent.ts — real (not mock) tool-calling agent that runs Alfred
// entirely server-side, invoked by twilio-sms-webhook.ts when the owner
// texts their own CRM Twilio number from their personal phone
// (settings.myPhone, gated by settings.alfredSmsEnabled). This lets the
// owner say things like "reschedule Tuesday's job with Mike to Thursday and
// text him" or "who's on job 2 right now" directly over SMS, with Alfred
// actually reading/writing the CRM (via the service-role key, same
// credentials the rest of this webhook already uses) and replying by text.
//
// This is a deliberately SMALLER tool set than the in-app Alfred
// (AlfredPage.tsx, ~25 tools) — only the handful of actions an owner is
// realistically going to want to trigger from a text message while away
// from the CRM. Everything it does is a REAL Supabase write via the service
// role — no staged/fake actions.
//
// MODEL CHOICE — this used to hard-code Anthropic Claude only, with a
// comment claiming it was "the one provider with no browser-CORS caveat."
// That reasoning never applied here: this file runs server-side in a
// Cloudflare Pages Function, not a browser, so CORS was never a constraint
// for ANY provider — the in-app Alfred (AlfredPage.tsx) only avoids some
// providers because IT runs in the browser. This file follows the exact
// same model-selection convention as the in-app Alfred instead: whichever
// provider is first in the owner's settings.modelPriority (falling back to
// settings.activeModel, then any model with a key at all) that has a key
// saved in settings.modelKeys, with automatic failover to the next
// configured provider on error — so an owner using Gemini, Kimi (NVIDIA),
// or any other supported provider for in-app Alfred gets the exact same
// provider over text, no separate Anthropic key required.
//
// Underscore-prefixed folder (_lib) — per Cloudflare Pages Functions
// convention this is NOT routable, purely a shared module for the actual
// route files (twilio-sms-webhook.ts) to import from.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";

// Mirrors the provider/endpoint/modelId table in src/lib/api.ts's MODELS —
// duplicated here (not imported) because functions/ is a separate Cloudflare
// Pages Functions build with no access to src/. Keep in sync if a model is
// added/renamed there.
const SMS_MODELS: Record<string, { provider: string; modelId: string; endpoint: string; name: string; maxTokens: number; supportsTools: boolean }> = {
  claude: { provider: "anthropic", modelId: "claude-sonnet-4-20250514", endpoint: "https://api.anthropic.com/v1/messages", name: "Claude", maxTokens: 500, supportsTools: true },
  openai: { provider: "openai", modelId: "gpt-4o", endpoint: "https://api.openai.com/v1/chat/completions", name: "GPT-4o", maxTokens: 500, supportsTools: true },
  gemini: { provider: "google", modelId: "gemini-2.5-flash", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", name: "Gemini", maxTokens: 500, supportsTools: true },
  groq: { provider: "openai-compat", modelId: "llama-3.3-70b-versatile", endpoint: "https://api.groq.com/openai/v1/chat/completions", name: "Groq", maxTokens: 500, supportsTools: true },
  mistral: { provider: "openai-compat", modelId: "mistral-large-latest", endpoint: "https://api.mistral.ai/v1/chat/completions", name: "Mistral", maxTokens: 500, supportsTools: true },
  nvidia_kimi: { provider: "openai-compat", modelId: "moonshotai/kimi-k2.6", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", name: "Kimi K2.6", maxTokens: 500, supportsTools: true },
  nvidia_nemotron: { provider: "openai-compat", modelId: "nvidia/llama-3.1-nemotron-70b-instruct", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", name: "Nemotron 70B", maxTokens: 500, supportsTools: true },
  nvidia_deepseek_r1: { provider: "openai-compat", modelId: "deepseek-ai/deepseek-r1", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", name: "DeepSeek R1", maxTokens: 500, supportsTools: true },
  nvidia_qwen: { provider: "openai-compat", modelId: "qwen/qwen2.5-7b-instruct", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", name: "Qwen 2.5 7B", maxTokens: 500, supportsTools: true },
};
const DEFAULT_MODEL_PRIORITY = ["claude", "openai", "gemini", "groq", "mistral"];

// ─── Unified per-provider model caller (server-side — no CORS constraint) ──
// Returns { text, toolUses, stopReason, raw } — `raw` is pushed straight
// back as the next "assistant" turn's content on a tool-use round, same
// pattern src/lib/api.ts's callModel uses for the in-app Alfred.
const callSmsModel = async (
  modelKey: string,
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: any }>,
  tools: any[],
): Promise<{ text: string; toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>; stopReason: string; raw: unknown }> => {
  const def = SMS_MODELS[modelKey];
  if (!def) throw new Error(`Unknown model "${modelKey}"`);

  if (def.provider === "anthropic") {
    const body = { model: def.modelId, max_tokens: def.maxTokens, system: systemPrompt, messages, tools };
    const res = await fetch(def.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${def.name} HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = await res.json() as { content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>; stop_reason?: string };
    const text = data.content?.find(b => b.type === "text")?.text ?? "";
    const toolUses = (data.content ?? []).filter(b => b.type === "tool_use").map(b => ({ id: b.id!, name: b.name!, input: b.input ?? {} }));
    return { text, toolUses, stopReason: data.stop_reason ?? "end_turn", raw: data.content };
  }

  if (def.provider === "google") {
    const contents = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => {
        if (typeof m.content === "string") return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
        if (Array.isArray(m.content) && m.content[0]?.type === "tool_result") {
          const parts = (m.content as Array<{ tool_use_id: string; content: string }>).map(tr => ({
            functionResponse: { name: tr.tool_use_id, response: (() => { try { return JSON.parse(tr.content); } catch { return { result: tr.content }; } })() },
          }));
          return { role: "user", parts };
        }
        if (Array.isArray(m.content)) return { role: "model", parts: m.content };
        return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] };
      });
    const geminiTools = tools?.length ? [{ functionDeclarations: tools.map((t: any) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }] : undefined;
    const res = await fetch(`${def.endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(geminiTools ? { tools: geminiTools } : {}),
        generationConfig: { maxOutputTokens: def.maxTokens, thinkingConfig: { thinkingBudget: 0 } },
        ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`${def.name} HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> }; finishReason?: string }> };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter(p => typeof p.text === "string" && p.text).map(p => p.text as string).join("");
    const toolUses = parts.filter(p => p.functionCall).map(p => {
      const fc = p.functionCall as { name: string; args?: Record<string, unknown> };
      return { id: fc.name, name: fc.name, input: fc.args ?? {} };
    });
    const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
    return { text, toolUses, stopReason, raw: parts.length ? parts : [{ text }] };
  }

  // openai-compat: OpenAI, Groq, Mistral, NVIDIA NIM — all mirror OpenAI's
  // chat completions API verbatim.
  const openAiMessages: Array<Record<string, unknown>> = [{ role: "system", content: systemPrompt }];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (typeof m.content === "string") {
      openAiMessages.push({ role: m.role, content: m.content });
    } else if (Array.isArray(m.content) && m.content[0]?.type === "tool_result") {
      for (const tr of m.content as Array<{ tool_use_id: string; content: string }>) {
        openAiMessages.push({ role: "tool", tool_call_id: tr.tool_use_id, content: tr.content });
      }
    } else if (m.role === "assistant" && m.content && typeof m.content === "object" && !Array.isArray(m.content)) {
      openAiMessages.push(m.content as Record<string, unknown>);
    } else if (Array.isArray(m.content)) {
      const text = (m.content as Array<{ type: string; text?: string }>).filter(b => b.type === "text").map(b => b.text ?? "").join("");
      openAiMessages.push({ role: m.role, content: text });
    }
  }
  const openAiTools = tools?.length ? tools.map((t: any) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })) : undefined;
  const res = await fetch(def.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: def.modelId, max_tokens: def.maxTokens, messages: openAiMessages, ...(openAiTools ? { tools: openAiTools } : {}) }),
  });
  if (!res.ok) throw new Error(`${def.name} HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; function?: { name: string; arguments?: string } }> } }> };
  const choice = data.choices?.[0]?.message;
  const text = choice?.content ?? "";
  const toolUses = (choice?.tool_calls ?? []).map(tc => ({ id: tc.id, name: tc.function?.name ?? "", input: (() => { try { return JSON.parse(tc.function?.arguments || "{}"); } catch { return {}; } })() }));
  const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
  return { text, toolUses, stopReason, raw: choice ?? { role: "assistant", content: text } };
};

// Same US-country-code normalization fix as twilio-sms-webhook.ts — an
// E.164 number ("+17173411794") and a plain 10-digit one ("7173411794")
// must compare equal, or thread-matching here silently creates duplicate
// inbox threads for what's really the same contact.
const normalizePhoneDigits = (p: string) => {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};
const today = () => new Date().toISOString().slice(0, 10);

type Ctx = {
  authHeaders: Record<string, string>;
  ownerId: string | null;
  companyName: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  origin: string;
  // Whichever authorized number is actually texting Alfred right now — used
  // by the text_me tool as "send it back to whoever's asking," so it works
  // correctly whether the owner is texting from myPhone or one of
  // alfredExtraPhones, without needing a separate "which is the real owner
  // number" lookup.
  fromPhone?: string;
  // Owner's Google OAuth tokens (from app_settings, same fields the in-app
  // Gmail send already reads) — lets create_calendar_event act on the
  // owner's REAL Google Calendar from a text, not just the CRM's own job
  // records.
  googleProviderToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiresAt?: number;
};

// ─── Supabase helpers (service-role REST, same pattern as the webhook) ────

// FIX — a read scoped with `&owner_id=eq.X` 400s outright on any table that
// doesn't have that column yet (migration 0033 not applied — verified live
// on this deployment: app_settings.owner_id is already populated, but
// customers/jobs/employees/inbox_threads have no such column yet), and
// PostgREST's error body isn't an array, so it used to just silently
// resolve to "no rows" — every lookup in this agent (find the customer,
// find the job) would quietly fail as "not found" instead of erroring.
// Detect that specific failure and retry once without the owner_id clause.
const sbGet = async (ctx: Ctx, path: string): Promise<any[]> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: ctx.authHeaders });
  const data = await res.json().catch(() => []);
  if (Array.isArray(data)) return data;
  if (!res.ok && path.includes("owner_id=eq.")) {
    const strippedPath = path.replace(/&owner_id=eq\.[^&]+/, "");
    const retryRes = await fetch(`${SUPABASE_URL}/rest/v1/${strippedPath}`, { headers: ctx.authHeaders });
    const retryData = await retryRes.json().catch(() => []);
    return Array.isArray(retryData) ? retryData : [];
  }
  return [];
};

// CLAUDE.md "safe column retry" pattern — a write scoped by owner_id can
// fail outright if migration 0033 hasn't been applied yet (no such column),
// which would reject the ENTIRE insert/update, not just drop the filter.
// Try WITH owner_id first (the correct, tenant-scoped shape once the
// migration is live); on any non-2xx, retry once without it so this agent
// still works on a pre-migration single-tenant deployment.
const sbWrite = async (ctx: Ctx, path: string, method: "POST" | "PATCH", body: Record<string, unknown>): Promise<{ ok: boolean; data: any; error?: string }> => {
  const withOwner = ctx.ownerId ? { ...body, owner_id: ctx.ownerId } : body;
  const attempt = async (payload: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(method === "POST" ? [payload] : payload),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
    return { ok: res.ok, data, error: res.ok ? undefined : (data?.message || text || `HTTP ${res.status}`) };
  };
  let result = await attempt(withOwner);
  if (!result.ok && ctx.ownerId) {
    console.warn("[AlfredSms] write with owner_id failed, retrying without it:", result.error);
    result = await attempt(body);
  }
  return result;
};

const ownerScope = (ctx: Ctx) => (ctx.ownerId ? `&owner_id=eq.${encodeURIComponent(ctx.ownerId)}` : "");

// ─── Tool implementations ──────────────────────────────────────────────────

const findCustomerByName = async (ctx: Ctx, name: string) => {
  const rows = await sbGet(ctx, `customers?select=id,firstName,lastName,phone,email${ownerScope(ctx)}&limit=500`);
  const q = name.toLowerCase().trim();
  return rows.find((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().trim() === q)
    || rows.find((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().includes(q));
};

const findEmployeeByName = async (ctx: Ctx, name: string) => {
  const rows = await sbGet(ctx, `employees?select=id,firstName,lastName,phone,status,dayClockInAt${ownerScope(ctx)}&limit=200`);
  const q = name.toLowerCase().trim();
  return rows.find((e: any) => `${e.firstName || ""} ${e.lastName || ""}`.toLowerCase().trim() === q)
    || rows.find((e: any) => `${e.firstName || ""} ${e.lastName || ""}`.toLowerCase().includes(q));
};

const findJob = async (ctx: Ctx, { jobId, customerName, dateHint }: { jobId?: string; customerName?: string; dateHint?: string }) => {
  const rows = await sbGet(ctx, `jobs?select=id,customerId,customerName,status,scheduledDate,scheduledTime,crew,assignedTo,address,checklist${ownerScope(ctx)}&limit=500`);
  if (jobId) return rows.find((j: any) => j.id === jobId) || null;
  let candidates = rows;
  if (customerName) {
    const q = customerName.toLowerCase().trim();
    candidates = candidates.filter((j: any) => (j.customerName || "").toLowerCase().includes(q));
  }
  if (dateHint) candidates = candidates.filter((j: any) => j.scheduledDate === dateHint);
  candidates = candidates.filter((j: any) => j.status !== "cancelled" && j.status !== "completed");
  candidates.sort((a: any, b: any) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
  return candidates[0] || null;
};

// `isOwnerReply` — true only for the reply Alfred sends back to the OWNER
// (text_me / the main SMS bridge reply), never for text_customer/reschedule
// notify/send_invoice/send_estimate (those go to a real customer and should
// keep showing that customer's own name, not "Alfred"). Every Alfred-sent
// message still carries `via: "alfred"` regardless, so the Inbox can badge
// it as "from Alfred" in ANY thread, customer or owner.
export const sendAlfredSms = async (ctx: Ctx, toPhone: string, body: string): Promise<{ ok: boolean; error?: string }> => sendSms(ctx, toPhone, body, true);

const sendSms = async (ctx: Ctx, toPhone: string, body: string, isOwnerReply = false): Promise<{ ok: boolean; error?: string }> => {
  if (!ctx.twilioSid || !ctx.twilioToken || !ctx.twilioFrom) return { ok: false, error: "Twilio isn't configured for this account." };
  const auth = `Basic ${btoa(`${ctx.twilioSid}:${ctx.twilioToken}`)}`;
  const params = new URLSearchParams({ To: toPhone, From: ctx.twilioFrom, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ctx.twilioSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) return { ok: false, error: (await res.text().catch(() => "")).slice(0, 200) };
  // Log to inbox_threads so it shows up in the owner's Inbox too, same as
  // every other outbound SMS in this app (CLAUDE.md "Critical rules").
  try {
    const threads = await sbGet(ctx, `inbox_threads?channel=eq.sms&select=id,contact_phone,messages${ownerScope(ctx)}`);
    const digits = normalizePhoneDigits(toPhone);
    const existing = threads.find((t: any) => normalizePhoneDigits(t.contact_phone) === digits);
    // BUG FIX — was always `dir: "out"` with no marker at all, so a reply
    // Alfred sent to the OWNER looked in the Inbox exactly like a normal
    // outgoing message the owner sent themselves, with no way to tell them
    // apart. `via: "alfred"` lets the UI badge it "Alfred" regardless of
    // which thread it lands in.
    const msg = { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred" };
    if (existing) {
      await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?id=eq.${encodeURIComponent(existing.id)}`, {
        method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ messages: [...(existing.messages || []), msg], last_message_at: msg.ts, updated_at: new Date().toISOString() }),
      });
    } else {
      await sbWrite(ctx, "inbox_threads", "POST", { id: crypto.randomUUID(), channel: "sms", contact_name: isOwnerReply ? "Alfred" : toPhone, contact_phone: toPhone, unread: false, messages: [msg], last_message_at: msg.ts, updated_at: new Date().toISOString() });
    }
  } catch (e: any) { console.warn("[AlfredSms] inbox log failed:", e?.message); }
  return { ok: true };
};

const TOOLS = [
  {
    name: "get_business_stats",
    description: "Get a snapshot of current business stats: active jobs, pending estimates, revenue this month, jobs completed this month.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_jobs",
    description: "List jobs, optionally filtered by status or date (YYYY-MM-DD).",
    input_schema: { type: "object", properties: { status: { type: "string", enum: ["all", "scheduled", "in_progress", "completed", "cancelled"] }, date: { type: "string", description: "YYYY-MM-DD, optional" } } },
  },
  {
    name: "get_employee_status",
    description: "Who is currently clocked in, and what job each is on (with checklist progress). Use this for 'what's the update on my crew' type questions.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "schedule_job",
    description: "Schedule a new job for a customer on a given date. Can optionally assign a crew member by name, or mark the owner as working it.",
    input_schema: {
      type: "object",
      properties: {
        customerName: { type: "string", description: "Existing customer's full name" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM 24h, optional" },
        employeeName: { type: "string", description: "Crew member to assign, optional" },
        ownerWorks: { type: "boolean", description: "true if the owner themself is doing this job" },
        notes: { type: "string" },
      },
      required: ["customerName", "date"],
    },
  },
  {
    name: "reschedule_job",
    description: "Move an existing job to a new date/time. Identify the job by customer name (finds their next upcoming job) or by jobId if known from an earlier tool result.",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        customerName: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM, optional" },
        notify: { type: "string", enum: ["none", "sms"], description: "Whether to text the customer about the new time" },
      },
      required: ["date"],
    },
  },
  {
    name: "assign_employee",
    description: "Assign a crew member to a job. Identify the job by customerName or jobId.",
    input_schema: {
      type: "object",
      properties: { jobId: { type: "string" }, customerName: { type: "string" }, employeeName: { type: "string" } },
      required: ["employeeName"],
    },
  },
  {
    name: "create_customer",
    description: "Create a new customer record.",
    input_schema: {
      type: "object",
      properties: { firstName: { type: "string" }, lastName: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, address: { type: "string" } },
      required: ["firstName", "lastName"],
    },
  },
  {
    name: "text_customer",
    description: "Send an arbitrary SMS to a customer, e.g. 'text the customer that we're running 20 minutes late'.",
    input_schema: {
      type: "object",
      properties: { customerName: { type: "string" }, message: { type: "string" } },
      required: ["customerName", "message"],
    },
  },
  {
    name: "list_overdue_invoices",
    description: "List invoices (estimates marked invoiced) that are unpaid, with customer name and amount.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "send_invoice",
    description: "Text a payment link for an existing unpaid invoice to the customer. Use list_overdue_invoices or list_jobs first if you need to figure out which invoice — this does not create a new invoice, only sends one that already exists.",
    input_schema: {
      type: "object",
      properties: { invoiceId: { type: "string" }, customerName: { type: "string", description: "Alternative to invoiceId — sends that customer's most recent unpaid invoice" } },
    },
  },
  {
    name: "text_me",
    description: "Text the OWNER (the person you're already texting with) a message right now — use this whenever they ask you to text/message THEM something (not a customer), e.g. 'text me the schedule for tomorrow' or 'send that to my phone'.",
    input_schema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
  // ROUND — capability parity pass with the in-app Alfred (AlfredPage.tsx).
  // These 7 tools were the biggest real gaps: no way to cancel a job, look
  // up job/customer details, touch a checklist, reprioritize a job, or
  // create/send a fresh quote, all from a text.
  {
    name: "cancel_job",
    description: "Cancel an existing job. Identify it by jobId (from an earlier tool result) or customerName (cancels their next upcoming job).",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string" }, customerName: { type: "string" },
        reason: { type: "string" },
        notify: { type: "string", enum: ["none", "sms"], description: "Whether to text the customer that it's cancelled" },
      },
    },
  },
  {
    name: "get_job_details",
    description: "Full detail on one job — address, crew, checklist progress, photo count, payment status. Use for 'what's the status on X's job' type questions. For a lighter list of many jobs use list_jobs instead.",
    input_schema: {
      type: "object",
      properties: { jobId: { type: "string" }, customerName: { type: "string", description: "Finds that customer's most recent non-cancelled job" } },
    },
  },
  {
    name: "add_checklist_item",
    description: "Add an item to a job's checklist (pre-arrival, during-service, or post-service phase).",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string" }, item: { type: "string" },
        phase: { type: "string", enum: ["pre", "during", "post"], description: "Defaults to pre if omitted" },
      },
      required: ["jobId", "item"],
    },
  },
  {
    name: "update_job_priority",
    description: "Change a job's priority level.",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string" }, customerName: { type: "string" },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
      },
      required: ["priority"],
    },
  },
  {
    name: "get_customer_details",
    description: "Look up a customer's contact info, total spent, and recent job history by name.",
    input_schema: {
      type: "object",
      properties: { customerName: { type: "string" } },
      required: ["customerName"],
    },
  },
  {
    name: "create_estimate",
    description: "Create a new quote/estimate for a customer with one line item description and a total amount. Does NOT text it to the customer — call send_estimate after (or in the same reply) to actually deliver it. For 'send an invoice for $X' set invoiced true.",
    input_schema: {
      type: "object",
      properties: {
        customerName: { type: "string" },
        description: { type: "string", description: "What the line item is for, e.g. 'House wash + driveway'" },
        amount: { type: "number" },
        invoiced: { type: "boolean", description: "true = this is an invoice (payment due now), false/omitted = a quote awaiting approval" },
      },
      required: ["customerName", "amount"],
    },
  },
  {
    name: "send_estimate",
    description: "Text a customer the link to view/sign (or pay, if invoiced) an existing estimate. Use create_estimate first if it doesn't exist yet, or list_overdue_invoices/get_customer_details to find an existing one's id.",
    input_schema: {
      type: "object",
      properties: { estimateId: { type: "string" }, customerName: { type: "string", description: "Alternative to estimateId — sends that customer's most recent estimate" } },
    },
  },
  {
    name: "remember",
    description: "Save a fact/note for later recall — use whenever the owner says 'remember that...', 'keep track of...', 'note that...', or similar. Not a scheduled reminder (use set_reminder for a future text) — this is just durable memory you can look up later with recall.",
    input_schema: {
      type: "object",
      properties: { fact: { type: "string" }, category: { type: "string", description: "optional grouping, e.g. 'gate codes', 'customer preferences'" } },
      required: ["fact"],
    },
  },
  {
    name: "recall",
    description: "Look up previously remembered facts/notes, optionally filtered by a search term. Use this when the owner asks 'what did I tell you about X' or 'what do you have saved'.",
    input_schema: {
      type: "object",
      properties: { search: { type: "string", description: "optional keyword to filter by" } },
    },
  },
  {
    name: "set_reminder",
    description: "Schedule a text reminder to be sent back to the owner at a specific future time — use for 'remind me to X at/in/on Y'. Resolve the due time to an exact ISO 8601 datetime yourself (you're told today's date and time in the system prompt) before calling this — never pass a vague phrase.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "what to remind the owner about" },
        dueAtIso: { type: "string", description: "exact ISO 8601 datetime to send the reminder, e.g. 2026-08-23T14:00:00" },
      },
      required: ["message", "dueAtIso"],
    },
  },
  {
    name: "list_reminders",
    description: "List the owner's upcoming (not-yet-sent) reminders.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cancel_reminder",
    description: "Cancel a pending reminder. Use list_reminders first to find its id if the owner doesn't give you one directly.",
    input_schema: {
      type: "object",
      properties: { reminderId: { type: "string" } },
      required: ["reminderId"],
    },
  },
  {
    name: "get_calendar_summary",
    description: "What's on the schedule over a date range — use for 'what's on my calendar', 'what do I have this week', etc.",
    input_schema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        days: { type: "number", description: "how many days forward to include, default 7" },
      },
    },
  },
  {
    name: "create_calendar_event",
    description: "Add an event to the owner's actual Google Calendar (not just a CRM job — use schedule_job for an actual pressure-washing job with a customer). Use this for things like 'put a dentist appointment on my calendar Thursday at 2pm'.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM 24h" },
        durationMinutes: { type: "number", description: "default 60" },
        notes: { type: "string" },
      },
      required: ["title", "date", "time"],
    },
  },
  {
    name: "list_job_requests",
    description: "List pending job requests from employees (an employee asked to be assigned/take on a job and is waiting on approval).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "respond_to_job_request",
    description: "Approve or deny a pending employee job request. Use list_job_requests first to find its id.",
    input_schema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        approve: { type: "boolean" },
        reason: { type: "string", description: "optional, mainly useful when denying" },
      },
      required: ["requestId", "approve"],
    },
  },
];

const executeTool = async (ctx: Ctx, name: string, input: Record<string, any>): Promise<any> => {
  try {
    switch (name) {
      case "get_business_stats": {
        const [jobs, estimates] = await Promise.all([
          sbGet(ctx, `jobs?select=id,status,amount,completedAt,createdAt${ownerScope(ctx)}&limit=2000`),
          sbGet(ctx, `estimates?select=id,status,invoiced,total,paidAt,createdAt${ownerScope(ctx)}&limit=2000`),
        ]);
        const monthPrefix = today().slice(0, 7);
        const activeJobs = jobs.filter((j: any) => j.status === "scheduled" || j.status === "in_progress").length;
        const pendingEst = estimates.filter((e: any) => !e.invoiced && e.status !== "declined").length;
        const revenueMonth = jobs.filter((j: any) => (j.completedAt || "").startsWith(monthPrefix)).reduce((s: number, j: any) => s + (Number(j.amount) || 0), 0);
        const completedMonth = jobs.filter((j: any) => (j.completedAt || "").startsWith(monthPrefix)).length;
        return { success: true, activeJobs, pendingEstimates: pendingEst, revenueThisMonth: revenueMonth, jobsCompletedThisMonth: completedMonth };
      }
      case "list_jobs": {
        let rows = await sbGet(ctx, `jobs?select=id,customerName,status,scheduledDate,scheduledTime,address,crew${ownerScope(ctx)}&limit=200`);
        if (input.status && input.status !== "all") rows = rows.filter((j: any) => j.status === input.status);
        if (input.date) rows = rows.filter((j: any) => j.scheduledDate === input.date);
        rows.sort((a: any, b: any) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
        return { success: true, jobs: rows.slice(0, 25).map((j: any) => ({ id: j.id, customer: j.customerName, status: j.status, date: j.scheduledDate, time: j.scheduledTime, address: j.address })) };
      }
      case "get_employee_status": {
        const emps = await sbGet(ctx, `employees?select=id,firstName,lastName,status,dayClockInAt${ownerScope(ctx)}&limit=200`);
        const onShift = emps.filter((e: any) => e.status === "active" && e.dayClockInAt);
        if (onShift.length === 0) return { success: true, summary: "No one is currently clocked in." };
        // FIX — this used to select a "checklist" column that doesn't exist
        // (the real columns are preChecklist/duringChecklist/postChecklist —
        // see CLAUDE.md), so PostgREST 400'd the WHOLE query on every call
        // and sbGet silently swallowed that into an empty array — every
        // on-shift employee always reported as "not currently on a job" no
        // matter what, which is exactly the bug reported: an employee who
        // had genuinely arrived at a job still came back as not on one.
        // Also broadened the match itself: a field employee's job goes
        // "in_progress" OR just carries an arrivedAt timestamp (the "I'm
        // Here" button) — status=eq.in_progress alone missed that case too,
        // same fix already applied to Dashboard.tsx's Live Team View.
        const jobs = await sbGet(ctx, `jobs?select=id,customerName,status,crew,preChecklist,duringChecklist,postChecklist,scheduledDate,arrivedAt${ownerScope(ctx)}&status=neq.completed&status=neq.cancelled&limit=200`);
        const report = onShift.map((e: any) => {
          const name = `${e.firstName || ""} ${e.lastName || ""}`.trim();
          const job = jobs.find((j: any) => Array.isArray(j.crew) && j.crew.includes(e.id) && (j.status === "in_progress" || !!j.arrivedAt));
          if (!job) return `${name}: clocked in, not currently on a job`;
          const checklist = [...(job.preChecklist || []), ...(job.duringChecklist || []), ...(job.postChecklist || [])];
          const done = checklist.filter((c: any) => c?.done).length;
          const pct = checklist.length ? Math.round((done / checklist.length) * 100) : null;
          return `${name}: on ${job.customerName}'s job${pct !== null ? ` (${pct}% checklist complete)` : ""}`;
        });
        return { success: true, summary: report.join("; ") };
      }
      case "schedule_job": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        let crew: string[] = [];
        if (input.employeeName) {
          const emp = await findEmployeeByName(ctx, input.employeeName);
          if (!emp) return { error: `No employee found matching "${input.employeeName}".` };
          crew = [emp.id];
        }
        const job = {
          id: crypto.randomUUID(),
          customerId: cust.id,
          customerName: `${cust.firstName || ""} ${cust.lastName || ""}`.trim(),
          status: "scheduled",
          scheduledDate: input.date,
          scheduledTime: input.time || "",
          crew,
          notes: input.notes || "",
          createdAt: new Date().toISOString(),
        };
        const res = await sbWrite(ctx, "jobs", "POST", job);
        if (!res.ok) return { error: res.error };
        return { success: true, jobId: job.id, customer: job.customerName, date: job.scheduledDate };
      }
      case "reschedule_job": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const patch: Record<string, unknown> = { scheduledDate: input.date };
        if (input.time) patch.scheduledTime = input.time;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        if (input.notify === "sms") {
          const cust = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(job.customerId)}&select=phone,firstName`))[0];
          if (cust?.phone) {
            const smsRes = await sendSms(ctx, cust.phone, `Hi ${cust.firstName || ""}, your ${ctx.companyName} appointment has been moved to ${input.date}${input.time ? " at " + input.time : ""}. Let us know if that doesn't work!`);
            if (!smsRes.ok) return { success: true, jobId: job.id, notifyError: smsRes.error };
          }
        }
        return { success: true, jobId: job.id, newDate: input.date };
      }
      case "assign_employee": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const emp = await findEmployeeByName(ctx, input.employeeName);
        if (!emp) return { error: `No employee found matching "${input.employeeName}".` };
        const crew = Array.from(new Set([...(Array.isArray(job.crew) ? job.crew : []), emp.id]));
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ crew }),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, jobId: job.id, employee: `${emp.firstName} ${emp.lastName}` };
      }
      case "create_customer": {
        const row = { id: crypto.randomUUID(), firstName: input.firstName, lastName: input.lastName, phone: input.phone || "", email: input.email || "", address: input.address || "", totalSpent: 0, createdAt: new Date().toISOString() };
        const res = await sbWrite(ctx, "customers", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, customerId: row.id };
      }
      case "text_customer": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        if (!cust.phone) return { error: `${input.customerName} has no phone number on file.` };
        const res = await sendSms(ctx, cust.phone, input.message);
        if (!res.ok) return { error: res.error };
        return { success: true, sentTo: `${cust.firstName} ${cust.lastName}` };
      }
      case "list_overdue_invoices": {
        const [rows, customers] = await Promise.all([
          sbGet(ctx, `estimates?select=id,customerId,total,invoiced,paidAt,invoicedAt${ownerScope(ctx)}&invoiced=eq.true&limit=200`),
          sbGet(ctx, `customers?select=id,firstName,lastName${ownerScope(ctx)}&limit=1000`),
        ]);
        const overdue = rows.filter((e: any) => !e.paidAt);
        if (overdue.length === 0) return { success: true, summary: "No overdue invoices." };
        const custName = (id: string) => { const c = customers.find((c: any) => c.id === id); return c ? `${c.firstName || ""} ${c.lastName || ""}`.trim() : "Unknown"; };
        return { success: true, invoices: overdue.slice(0, 15).map((e: any) => ({ id: e.id, customer: custName(e.customerId), amount: e.total, invoicedAt: e.invoicedAt })) };
      }
      case "send_invoice": {
        let inv: any = null;
        if (input.invoiceId) {
          inv = (await sbGet(ctx, `estimates?id=eq.${encodeURIComponent(input.invoiceId)}&select=id,customerId,total,paidAt`))[0];
        } else if (input.customerName) {
          const cust = await findCustomerByName(ctx, input.customerName);
          if (!cust) return { error: `No customer found matching "${input.customerName}".` };
          const rows = await sbGet(ctx, `estimates?customerId=eq.${encodeURIComponent(cust.id)}&invoiced=eq.true&select=id,customerId,total,paidAt,invoicedAt${ownerScope(ctx)}`);
          const unpaid = rows.filter((e: any) => !e.paidAt).sort((a: any, b: any) => (b.invoicedAt || "").localeCompare(a.invoicedAt || ""));
          inv = unpaid[0];
          if (!inv) return { error: `${input.customerName} has no unpaid invoice on file.` };
        } else {
          return { error: "Need either invoiceId or customerName." };
        }
        if (!inv) return { error: "Invoice not found." };
        if (inv.paidAt) return { error: "That invoice is already paid." };
        const cust = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(inv.customerId)}&select=phone,firstName,lastName`))[0];
        if (!cust?.phone) return { error: "That customer has no phone number on file." };
        const link = `${ctx.origin}/#/estimate/${inv.id}`;
        const res = await sendSms(ctx, cust.phone, `Hi ${cust.firstName || ""}, here's your invoice from ${ctx.companyName} for $${Number(inv.total || 0).toFixed(2)}: ${link}`);
        if (!res.ok) return { error: res.error };
        return { success: true, sentTo: `${cust.firstName} ${cust.lastName}`, amount: inv.total };
      }
      case "cancel_job": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const patch = { status: "cancelled", cancelReason: input.reason || "" };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        let notifyWarning: string | undefined;
        if (input.notify === "sms") {
          const cust = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(job.customerId)}&select=phone,firstName`))[0];
          if (cust?.phone) {
            const msg = `Hi ${cust.firstName || ""}, your ${ctx.companyName} appointment${job.scheduledDate ? " on " + job.scheduledDate : ""} has been cancelled.${input.reason ? ` (${input.reason})` : ""} Reach out any time to reschedule.`;
            const smsRes = await sendSms(ctx, cust.phone, msg);
            if (!smsRes.ok) notifyWarning = smsRes.error;
          } else {
            notifyWarning = "customer has no phone on file";
          }
        }
        return { success: true, jobId: job.id, ...(notifyWarning ? { notifyWarning } : {}) };
      }
      case "get_job_details": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const full = (await sbGet(ctx, `jobs?id=eq.${encodeURIComponent(job.id)}&select=id,customerId,customerName,address,scheduledDate,scheduledTime,status,amount,priority,notes,crew,preChecklist,duringChecklist,postChecklist,photos,paymentStatus,invoiced,paidAt`))[0];
        if (!full) return { error: "Job not found." };
        const emps = full.crew?.length ? await sbGet(ctx, `employees?select=id,firstName,lastName${ownerScope(ctx)}&limit=200`) : [];
        const crewNames = (full.crew || []).map((id: string) => { const e = emps.find((x: any) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; });
        const allCk = [...(full.preChecklist || []), ...(full.duringChecklist || []), ...(full.postChecklist || [])];
        return {
          jobId: full.id, customer: full.customerName, address: full.address, date: full.scheduledDate, time: full.scheduledTime,
          status: full.status, amount: full.amount, priority: full.priority, notes: full.notes, crew: crewNames,
          checklist: { totalItems: allCk.length, completed: allCk.filter((c: any) => c?.done).length },
          photoCount: (full.photos || []).length,
          paymentStatus: full.paymentStatus || (full.invoiced ? (full.paidAt ? "Paid" : "Invoiced, unpaid") : "Not invoiced"),
        };
      }
      case "add_checklist_item": {
        if (!input.jobId || !input.item) return { error: "jobId and item required" };
        const job = (await sbGet(ctx, `jobs?id=eq.${encodeURIComponent(input.jobId)}&select=preChecklist,duringChecklist,postChecklist`))[0];
        if (!job) return { error: "Job not found" };
        const phase = input.phase === "during" ? "duringChecklist" : input.phase === "post" ? "postChecklist" : "preChecklist";
        const updated = [...(job[phase] || []), { id: crypto.randomUUID(), label: input.item, done: false }];
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(input.jobId)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ [phase]: updated }),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, added: input.item, phase };
      }
      case "update_job_priority": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ priority: input.priority }),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, jobId: job.id, priority: input.priority };
      }
      case "get_customer_details": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        const jobs = await sbGet(ctx, `jobs?customerId=eq.${encodeURIComponent(cust.id)}&select=scheduledDate,status,amount${ownerScope(ctx)}&order=scheduledDate.desc&limit=5`);
        const full = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(cust.id)}&select=totalSpent,address`))[0];
        return {
          success: true, name: `${cust.firstName} ${cust.lastName}`.trim(), phone: cust.phone, email: cust.email,
          address: full?.address, totalSpent: full?.totalSpent || 0,
          recentJobs: jobs.map((j: any) => ({ date: j.scheduledDate, status: j.status, amount: j.amount })),
        };
      }
      case "create_estimate": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        const amount = Number(input.amount) || 0;
        if (amount <= 0) return { error: "amount must be greater than 0" };
        const invoiced = !!input.invoiced;
        const row = {
          id: crypto.randomUUID(), customerId: cust.id,
          lineItems: [{ id: crypto.randomUUID(), description: input.description || "Service", quantity: 1, unitPrice: amount }],
          subtotal: amount, discount: 0, depositRequired: 0, tax: 0, total: amount,
          status: "approved", createdAt: today(), validUntil: today(),
          terms: "Payment due upon receipt.", notes: "", invoiced, ...(invoiced ? { invoicedAt: today() } : {}),
        };
        const res = await sbWrite(ctx, "estimates", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, estimateId: row.id, customer: `${cust.firstName} ${cust.lastName}`.trim(), total: amount, invoiced };
      }
      case "send_estimate": {
        let est: any = null;
        if (input.estimateId) {
          est = (await sbGet(ctx, `estimates?id=eq.${encodeURIComponent(input.estimateId)}&select=id,customerId,total,invoiced,paidAt`))[0];
        } else if (input.customerName) {
          const cust = await findCustomerByName(ctx, input.customerName);
          if (!cust) return { error: `No customer found matching "${input.customerName}".` };
          const rows = await sbGet(ctx, `estimates?customerId=eq.${encodeURIComponent(cust.id)}&select=id,customerId,total,invoiced,paidAt,createdAt${ownerScope(ctx)}`);
          est = rows.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
          if (!est) return { error: `${input.customerName} has no estimate on file.` };
        } else {
          return { error: "Need either estimateId or customerName." };
        }
        if (!est) return { error: "Estimate not found." };
        const cust = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(est.customerId)}&select=phone,firstName`))[0];
        if (!cust?.phone) return { error: "That customer has no phone number on file." };
        const link = `${ctx.origin}/#/estimate/${est.id}`;
        const label = est.invoiced ? "invoice" : "estimate";
        const res = await sendSms(ctx, cust.phone, `Hi ${cust.firstName || ""}, here's your ${label} from ${ctx.companyName} for $${Number(est.total || 0).toFixed(2)}: ${link}`);
        if (!res.ok) return { error: res.error };
        return { success: true, sentTo: cust.firstName, amount: est.total, type: label };
      }
      case "text_me": {
        if (!ctx.fromPhone) return { error: "Don't know which number to text back." };
        const res = await sendSms(ctx, ctx.fromPhone, input.message);
        if (!res.ok) return { error: res.error };
        return { success: true };
      }
      case "remember": {
        if (!input.fact) return { error: "fact required" };
        const row = { id: crypto.randomUUID(), text: input.fact, category: input.category || "general" };
        const res = await sbWrite(ctx, "alfred_memory", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, remembered: input.fact };
      }
      case "recall": {
        const rows = await sbGet(ctx, `alfred_memory?select=text,category,created_at${ownerScope(ctx)}&order=created_at.desc&limit=100`);
        const q = (input.search || "").toLowerCase().trim();
        const filtered = q ? rows.filter((r: any) => (r.text || "").toLowerCase().includes(q) || (r.category || "").toLowerCase().includes(q)) : rows;
        if (filtered.length === 0) return { success: true, memories: [], summary: q ? `Nothing saved matching "${input.search}".` : "Nothing saved yet." };
        return { success: true, memories: filtered.slice(0, 20).map((r: any) => r.text) };
      }
      case "set_reminder": {
        if (!input.message || !input.dueAtIso) return { error: "message and dueAtIso required" };
        const dueAt = new Date(input.dueAtIso);
        if (isNaN(dueAt.getTime())) return { error: "dueAtIso isn't a valid date/time." };
        if (!ctx.fromPhone) return { error: "Don't know which number to remind." };
        const row = { id: crypto.randomUUID(), phone: ctx.fromPhone, message: input.message, due_at: dueAt.toISOString(), sent: false };
        const res = await sbWrite(ctx, "alfred_reminders", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, reminderId: row.id, dueAt: dueAt.toISOString() };
      }
      case "list_reminders": {
        const rows = await sbGet(ctx, `alfred_reminders?select=id,message,due_at${ownerScope(ctx)}&sent=eq.false&order=due_at.asc&limit=25`);
        if (rows.length === 0) return { success: true, reminders: [], summary: "No pending reminders." };
        return { success: true, reminders: rows.map((r: any) => ({ id: r.id, message: r.message, dueAt: r.due_at })) };
      }
      case "cancel_reminder": {
        if (!input.reminderId) return { error: "reminderId required" };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/alfred_reminders?id=eq.${encodeURIComponent(input.reminderId)}`, {
          method: "DELETE", headers: ctx.authHeaders,
        });
        if (!res.ok) return { error: "Couldn't cancel — " + (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true };
      }
      case "get_calendar_summary": {
        const start = input.startDate || today();
        const days = Math.max(1, Math.min(30, Number(input.days) || 7));
        const end = new Date(start + "T00:00:00");
        end.setDate(end.getDate() + days);
        const endStr = end.toISOString().slice(0, 10);
        const rows = await sbGet(ctx, `jobs?select=id,customerName,status,scheduledDate,scheduledTime,address${ownerScope(ctx)}&scheduledDate=gte.${start}&scheduledDate=lt.${endStr}&limit=200`);
        const active = rows.filter((j: any) => j.status !== "cancelled").sort((a: any, b: any) => (a.scheduledDate + (a.scheduledTime || "")).localeCompare(b.scheduledDate + (b.scheduledTime || "")));
        if (active.length === 0) return { success: true, summary: `Nothing scheduled from ${start} to ${endStr}.` };
        return { success: true, jobs: active.map((j: any) => ({ date: j.scheduledDate, time: j.scheduledTime, customer: j.customerName, address: j.address, status: j.status })) };
      }
      case "create_calendar_event": {
        if (!ctx.googleRefreshToken && !ctx.googleProviderToken) return { error: "Google Calendar isn't connected — connect it in Settings → Integrations first." };
        let accessToken = ctx.googleProviderToken || "";
        if (ctx.googleRefreshToken && (!ctx.googleTokenExpiresAt || Date.now() > ctx.googleTokenExpiresAt - 60000)) {
          try {
            const refreshRes = await fetch(`${ctx.origin}/api/google-refresh`, {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: ctx.googleRefreshToken }),
            });
            const refreshData = await refreshRes.json().catch(() => null) as any;
            if (refreshRes.ok && refreshData?.access_token) accessToken = refreshData.access_token;
          } catch { /* fall through with whatever token we have; the Calendar call below will fail clearly if it's stale */ }
        }
        if (!accessToken) return { error: "Couldn't get a valid Google token — try reconnecting Google in Settings." };
        const durationMin = Number(input.durationMinutes) || 60;
        const startIso = `${input.date}T${input.time}:00`;
        const startDate = new Date(startIso);
        if (isNaN(startDate.getTime())) return { error: "Couldn't parse that date/time." };
        const endDate = new Date(startDate.getTime() + durationMin * 60000);
        const evRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: input.title,
            description: input.notes || "",
            start: { dateTime: startDate.toISOString() },
            end: { dateTime: endDate.toISOString() },
          }),
        });
        if (!evRes.ok) return { error: "Google Calendar error: " + (await evRes.text().catch(() => "")).slice(0, 200) };
        return { success: true, title: input.title, date: input.date, time: input.time };
      }
      case "list_job_requests": {
        const rows = await sbGet(ctx, `job_requests?select=id,employee_id,job_id,message,status${ownerScope(ctx)}&status=eq.pending&limit=50`);
        if (rows.length === 0) return { success: true, requests: [], summary: "No pending job requests." };
        const [emps, jbs] = await Promise.all([
          sbGet(ctx, `employees?select=id,firstName,lastName${ownerScope(ctx)}&limit=200`),
          sbGet(ctx, `jobs?select=id,customerName,scheduledDate${ownerScope(ctx)}&limit=500`),
        ]);
        return {
          success: true,
          requests: rows.map((r: any) => {
            const emp = emps.find((e: any) => e.id === r.employee_id);
            const job = jbs.find((j: any) => j.id === r.job_id);
            return { id: r.id, employee: emp ? `${emp.firstName} ${emp.lastName}` : r.employee_id, job: job ? `${job.customerName} (${job.scheduledDate})` : r.job_id, message: r.message };
          }),
        };
      }
      case "respond_to_job_request": {
        if (!input.requestId || input.approve === undefined) return { error: "requestId and approve required" };
        const patch: Record<string, unknown> = { status: input.approve ? "approved" : "denied", responded_at: new Date().toISOString() };
        if (!input.approve && input.reason) patch.denial_reason = input.reason;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/job_requests?id=eq.${encodeURIComponent(input.requestId)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return { error: "Couldn't update the request — " + (await res.text().catch(() => "")).slice(0, 200) };
        // Approving assigns the employee to the job's crew, same as the CRM's own approve action.
        if (input.approve) {
          const reqRow = (await sbGet(ctx, `job_requests?id=eq.${encodeURIComponent(input.requestId)}&select=employee_id,job_id`))[0];
          if (reqRow?.job_id && reqRow?.employee_id) {
            const job = (await sbGet(ctx, `jobs?id=eq.${encodeURIComponent(reqRow.job_id)}&select=id,crew`))[0];
            if (job) {
              const crew = Array.from(new Set([...(Array.isArray(job.crew) ? job.crew : []), reqRow.employee_id]));
              await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
                method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
                body: JSON.stringify({ crew }),
              });
            }
          }
        }
        return { success: true, status: input.approve ? "approved" : "denied" };
      }
      default:
        return { error: `Unknown tool "${name}".` };
    }
  } catch (e: any) {
    return { error: e?.message || "Tool execution failed." };
  }
};

// ─── Conversation persistence ──────────────────────────────────────────────

const loadThread = async (ctx: Ctx, phone: string): Promise<Array<{ role: string; content: string }>> => {
  if (!ctx.ownerId) return [];
  const rows = await sbGet(ctx, `alfred_sms_threads?owner_id=eq.${encodeURIComponent(ctx.ownerId)}&phone=eq.${encodeURIComponent(phone)}&select=messages&limit=1`);
  const msgs = rows[0]?.messages;
  return Array.isArray(msgs) ? msgs.slice(-16) : [];
};

const saveThread = async (ctx: Ctx, phone: string, messages: Array<{ role: string; content: string }>) => {
  if (!ctx.ownerId) return;
  const trimmed = messages.slice(-16);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/alfred_sms_threads?owner_id=eq.${encodeURIComponent(ctx.ownerId)}&phone=eq.${encodeURIComponent(phone)}`, {
    method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ messages: trimmed, updated_at: new Date().toISOString() }),
  });
  const updated = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(updated) || updated.length === 0) {
    await sbWrite(ctx, "alfred_sms_threads", "POST", { owner_id: ctx.ownerId, phone, messages: trimmed, updated_at: new Date().toISOString() });
  }
};

// ─── Main entry point ──────────────────────────────────────────────────────

export const runAlfredSmsAgent = async (
  ctx: Ctx,
  modelKeys: Record<string, string>,
  modelPriority: string[] | undefined,
  activeModel: string | undefined,
  fromPhone: string,
  incomingText: string
): Promise<string> => {
  // Same ordering rule as the in-app Alfred (AlfredPage.tsx FIX 20):
  // modelPriority is the real order, activeModel is only consulted as a
  // fallback when no priority list is saved — activeModel does not jump
  // the queue. Any other model with a key but not in the priority list
  // still gets tried, just last.
  const priority = (modelPriority && modelPriority.length ? modelPriority : (activeModel ? [activeModel] : DEFAULT_MODEL_PRIORITY));
  const extra = Object.keys(SMS_MODELS).filter(mid => !priority.includes(mid) && !!modelKeys?.[mid]);
  const chain = [...priority, ...extra].filter(mid => SMS_MODELS[mid] && !!modelKeys?.[mid]);

  if (chain.length === 0) {
    return "Alfred over text needs an AI model API key set in Settings → AI Models (any provider — Claude, GPT-4o, Gemini, Groq, Mistral, or a free NVIDIA model like Kimi) — add one there and text again.";
  }

  const history = await loadThread(ctx, fromPhone);
  const messages = [...history, { role: "user", content: incomingText }];

  const nowLocal = new Date().toISOString();
  const systemPrompt = `You are Alfred, the AI assistant for ${ctx.companyName}, a pressure-washing business — texting back and forth with the OWNER over SMS while they're away from the CRM. The current date/time is ${nowLocal} (UTC). Use tools aggressively to actually read and modify the CRM — never just describe what you'd do. Keep replies SHORT (this is a text message, 1-3 sentences, no markdown). If a tool result has an "error" field, tell the owner exactly what went wrong — do not claim success. When you finish an action, confirm plainly what happened.

CLARIFYING QUESTIONS: if a request is missing something a tool needs (which customer, which date, which job when there are several matches), ask ONE short, specific question instead of guessing — then stop and wait for their reply. The full conversation history is remembered, so when they answer, pick up exactly where you left off and finish the original request; don't make them repeat themselves.

FOLLOWING UP LATER: you are not limited to replying only in this exact moment. If a task naturally needs a check-in later (e.g. "did the crew actually show up", "nudge me if Mike hasn't replied by 3", "nudge me if [job] isn't marked done by tonight"), use set_reminder to text yourself — meaning the owner — back at that time, resolving any relative time ("in 20 min", "by 3pm", "tonight") into an exact ISO datetime using the current date/time above. This is a real scheduled text, not just a note — use it whenever the owner asks to be followed up with, checked on, or reminded about something, even mid-conversation.

You can: text the owner back on request (text_me), remember arbitrary facts/notes for later (remember/recall — use this whenever they say "remember", "keep track of", or "note that"), schedule future text reminders/follow-ups (set_reminder; list_reminders/cancel_reminder manage existing ones), summarize the schedule (get_calendar_summary), add a non-job event to the owner's real Google Calendar (create_calendar_event — use schedule_job instead for an actual pressure-washing job tied to a customer), and review/approve or deny employee job requests (list_job_requests, respond_to_job_request). Core CRM actions: create/reschedule/cancel jobs, reprioritize a job, look up full job or customer detail (get_job_details, get_customer_details), add a checklist item, assign employees, create customers, check who's clocked in and what they're working on, and create/send quotes and invoices (create_estimate then send_estimate — two steps, creating one does NOT notify the customer). Use whichever tool actually matches what's being asked, and don't hesitate to chain several tool calls in one exchange if the request needs it (e.g. reschedule a job AND text the customer AND remember a preference). You can also receive and understand voice memos sent as a text — they're transcribed automatically before you ever see them, so just respond to the transcribed content normally.`;

  let finalText = "";
  let succeeded = false;

  // Try each configured provider in priority order — a failure (bad key,
  // provider outage, timeout) falls through to the next one instead of
  // just failing the whole text, same failover behavior as in-app Alfred.
  for (const modelKey of chain) {
    const apiKey = modelKeys[modelKey];
    const def = SMS_MODELS[modelKey];
    let rounds = 0;
    let localFinal = "";
    let convMessages: Array<{ role: string; content: any }> = [...messages];
    let modelFailed = false;

    while (rounds < 4) {
      rounds++;
      // Twilio abandons an unanswered webhook after ~15s and shows the
      // customer/owner nothing — a hung provider call (no error, no
      // response) would otherwise burn that whole window silently across
      // up to 4 tool-loop rounds. Hard-cap each individual call so a stuck
      // round fails fast and falls over to the next model instead of the
      // SMS just never arriving with no clue why.
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 12000);
      try {
        const result = await Promise.race([
          callSmsModel(modelKey, apiKey, systemPrompt, convMessages, def.supportsTools ? TOOLS : []),
          new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("timed out")))),
        ]);
        clearTimeout(abortTimer);
        if (result.text) localFinal = result.text;
        if (result.toolUses.length > 0 && result.stopReason === "tool_use") {
          convMessages.push({ role: "assistant", content: result.raw });
          const results = await Promise.all(result.toolUses.map(async (tu) => ({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify(await executeTool(ctx, tu.name, tu.input || {})),
          })));
          convMessages.push({ role: "user", content: results });
          continue;
        }
        break;
      } catch (e: any) {
        clearTimeout(abortTimer);
        console.error(`[AlfredSms] ${def.name} call failed:`, e?.message);
        modelFailed = true;
        break;
      }
    }

    if (!modelFailed) {
      finalText = localFinal;
      succeeded = true;
      break;
    }
  }

  if (!succeeded) return "Sorry, I hit an error reaching every configured AI model — try again in a bit, or check your API keys in Settings → AI Models.";
  if (!finalText) finalText = "Done.";
  await saveThread(ctx, fromPhone, [...messages, { role: "assistant", content: finalText }]);
  return finalText;
};
