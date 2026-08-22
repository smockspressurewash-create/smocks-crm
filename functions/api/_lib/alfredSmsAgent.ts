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
// (AlfredPage.tsx, ~25 tools, 5 providers) — it only runs Anthropic Claude
// (the one provider with no browser-CORS caveat, and the model the app
// already recommends first), and only the handful of actions an owner is
// realistically going to want to trigger from a text message while away
// from the CRM. Everything it does is a REAL Supabase write via the service
// role — no staged/fake actions.
//
// Underscore-prefixed folder (_lib) — per Cloudflare Pages Functions
// convention this is NOT routable, purely a shared module for the actual
// route files (twilio-sms-webhook.ts) to import from.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const normalizePhoneDigits = (p: string) => (p || "").replace(/\D/g, "");
const today = () => new Date().toISOString().slice(0, 10);

type Ctx = {
  authHeaders: Record<string, string>;
  ownerId: string | null;
  companyName: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  origin: string;
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

export const sendAlfredSms = async (ctx: Ctx, toPhone: string, body: string): Promise<{ ok: boolean; error?: string }> => sendSms(ctx, toPhone, body);

const sendSms = async (ctx: Ctx, toPhone: string, body: string): Promise<{ ok: boolean; error?: string }> => {
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
    const msg = { id: crypto.randomUUID(), dir: "out", body, ts: Date.now() };
    if (existing) {
      await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?id=eq.${encodeURIComponent(existing.id)}`, {
        method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ messages: [...(existing.messages || []), msg], last_message_at: msg.ts, updated_at: new Date().toISOString() }),
      });
    } else {
      await sbWrite(ctx, "inbox_threads", "POST", { id: crypto.randomUUID(), channel: "sms", contact_name: toPhone, contact_phone: toPhone, unread: false, messages: [msg], last_message_at: msg.ts, updated_at: new Date().toISOString() });
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
        const jobs = await sbGet(ctx, `jobs?select=id,customerName,status,crew,checklist,scheduledDate${ownerScope(ctx)}&status=eq.in_progress&limit=200`);
        const report = onShift.map((e: any) => {
          const name = `${e.firstName || ""} ${e.lastName || ""}`.trim();
          const job = jobs.find((j: any) => Array.isArray(j.crew) && j.crew.includes(e.id));
          if (!job) return `${name}: clocked in, not currently on a job`;
          const checklist = Array.isArray(job.checklist) ? job.checklist : [];
          const done = checklist.filter((c: any) => c.done).length;
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
  anthropicKey: string,
  fromPhone: string,
  incomingText: string
): Promise<string> => {
  if (!anthropicKey) return "Alfred over text needs an Anthropic (Claude) API key set in Settings → AI Models — add one there and text again.";

  const history = await loadThread(ctx, fromPhone);
  const messages = [...history, { role: "user", content: incomingText }];

  const systemPrompt = `You are Alfred, the AI assistant for ${ctx.companyName}, a pressure-washing business — texting back and forth with the OWNER over SMS while they're away from the CRM. Use tools aggressively to actually read and modify the CRM — never just describe what you'd do. Keep replies SHORT (this is a text message, 1-3 sentences, no markdown). If a tool result has an "error" field, tell the owner exactly what went wrong — do not claim success. If a request is missing something a tool needs (which customer, which date), ask one short clarifying question instead of guessing. When you finish an action, confirm plainly what happened.`;

  let rounds = 0;
  let finalText = "";
  let convMessages: Array<{ role: string; content: any }> = messages;

  while (rounds < 4) {
    rounds++;
    const body: Record<string, unknown> = { model: ANTHROPIC_MODEL, max_tokens: 500, system: systemPrompt, messages: convMessages, tools: TOOLS };
    // Twilio abandons an unanswered webhook after ~15s and shows the
    // customer/owner nothing — a hung Anthropic call (no error, no
    // response) would otherwise burn that whole window silently across
    // up to 4 tool-loop rounds. Hard-cap each individual call so a stuck
    // round fails fast into the catch below (in twilio-sms-webhook.ts)
    // instead of the SMS just never arriving with no clue why.
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 12000);
    let res: Response;
    try {
      res = await fetch(ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e: any) {
      console.error("[AlfredSms] Anthropic call failed/timed out:", e?.message);
      return "Sorry, that took too long to process — try a shorter request, or try again in a bit.";
    } finally {
      clearTimeout(abortTimer);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[AlfredSms] Anthropic call failed:", res.status, errText.slice(0, 300));
      return "Sorry, I hit an error reaching my AI model — try again in a bit.";
    }
    const data = await res.json() as { content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>; stop_reason?: string };
    const text = data.content?.find(b => b.type === "text")?.text ?? "";
    const toolUses = (data.content || []).filter(b => b.type === "tool_use");
    if (text) finalText = text;

    if (toolUses.length > 0 && data.stop_reason === "tool_use") {
      convMessages.push({ role: "assistant", content: data.content });
      const results = await Promise.all(toolUses.map(async (tu: any) => ({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(await executeTool(ctx, tu.name, tu.input || {})),
      })));
      convMessages.push({ role: "user", content: results });
      continue;
    }
    break;
  }

  if (!finalText) finalText = "Done.";
  await saveThread(ctx, fromPhone, [...messages, { role: "assistant", content: finalText }]);
  return finalText;
};
