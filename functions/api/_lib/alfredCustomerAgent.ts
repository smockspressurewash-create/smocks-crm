// alfredCustomerAgent.ts — a deliberately SMALL, separate agent for texts
// FROM a customer who has been explicitly opted in to Alfred auto-response
// (customers."alfredAutoRespond" = true, off by default — see
// CustomerDetail.tsx's toggle). This is NOT the owner-facing agent
// (alfredSmsAgent.ts) reused with a different persona — it is a distinct,
// much narrower tool set on purpose:
//
//   - It can only ever read/act on THIS ONE customer's own records (matched
//     by their verified inbound phone number) — never search other
//     customers, never see other people's jobs, never see business-wide
//     financials. There is no tool here that takes a customerName/customerId
//     the model could substitute.
//   - It can answer routine questions directly (service pricing, their own
//     appointment status) — the scope the owner explicitly approved for
//     auto-handling.
//   - It CANNOT reschedule, cancel, or promise anything about money on its
//     own. propose_reschedule creates a pending row and texts the OWNER for
//     a yes/no — the customer only ever gets "let me check and get back to
//     you," never a committed new time, matching the owner's explicit
//     instruction that schedule/money changes need a human yes first.
//
// The owner's own Alfred conversation (alfredSmsAgent.ts) resolves pending
// requests via list_pending_customer_requests/approve_customer_request/
// decline_customer_request — this file only ever creates them, never
// resolves them itself.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const SMS_MODELS: Record<string, { provider: string; modelId: string; endpoint: string; maxTokens: number }> = {
  claude: { provider: "anthropic", modelId: "claude-sonnet-4-20250514", endpoint: "https://api.anthropic.com/v1/messages", maxTokens: 350 },
  openai: { provider: "openai-compat", modelId: "gpt-4o", endpoint: "https://api.openai.com/v1/chat/completions", maxTokens: 350 },
  gemini: { provider: "google", modelId: "gemini-2.5-flash", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", maxTokens: 350 },
  groq: { provider: "openai-compat", modelId: "llama-3.3-70b-versatile", endpoint: "https://api.groq.com/openai/v1/chat/completions", maxTokens: 350 },
  mistral: { provider: "openai-compat", modelId: "mistral-large-latest", endpoint: "https://api.mistral.ai/v1/chat/completions", maxTokens: 350 },
  nvidia_kimi: { provider: "openai-compat", modelId: "moonshotai/kimi-k2.6", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", maxTokens: 350 },
};
const DEFAULT_PRIORITY = ["claude", "openai", "gemini", "groq", "mistral"];

type Ctx = {
  authHeaders: Record<string, string>;
  ownerId: string | null;
  companyName: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  ownerPhone: string; // where proposals get texted for approval
};

const sbGet = async (ctx: Ctx, path: string): Promise<any[]> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: ctx.authHeaders });
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
};

const ownerScope = (ctx: Ctx) => (ctx.ownerId ? `&owner_id=eq.${encodeURIComponent(ctx.ownerId)}` : "");

const sendSms = async (ctx: Ctx, toPhone: string, body: string): Promise<boolean> => {
  if (!ctx.twilioSid || !ctx.twilioToken || !ctx.twilioFrom) return false;
  const auth = `Basic ${btoa(`${ctx.twilioSid}:${ctx.twilioToken}`)}`;
  const params = new URLSearchParams({ To: toPhone, From: ctx.twilioFrom, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ctx.twilioSid}/Messages.json`, {
    method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
  });
  if (!res.ok) return false;
  // Log to the OWNER's inbox thread with them, marked via:"alfred" — same
  // convention as alfredSmsAgent.ts — so a reschedule proposal shows up in
  // the owner's Inbox conversation with "Alfred" too, not just as an SMS.
  try {
    const threads = await sbGet(ctx, `inbox_threads?channel=eq.sms&select=id,contact_phone,messages${ownerScope(ctx)}`);
    const digits = (toPhone || "").replace(/\D/g, "");
    const norm = (p: string) => { const d = (p || "").replace(/\D/g, ""); return d.length === 11 && d.startsWith("1") ? d.slice(1) : d; };
    const existing = threads.find((t: any) => norm(t.contact_phone) === norm(digits));
    const msg = { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred" };
    if (existing) {
      await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?id=eq.${encodeURIComponent(existing.id)}`, {
        method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ messages: [...(existing.messages || []), msg], last_message_at: msg.ts, updated_at: new Date().toISOString() }),
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads`, {
        method: "POST", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ id: crypto.randomUUID(), channel: "sms", contact_name: "Alfred", contact_phone: toPhone, unread: false, messages: [msg], last_message_at: msg.ts, updated_at: new Date().toISOString(), ...(ctx.ownerId ? { owner_id: ctx.ownerId } : {}) }),
      });
    }
  } catch { /* non-fatal */ }
  return true;
};

const TOOLS = [
  {
    name: "get_my_appointment_status",
    description: "Look up THIS customer's own next upcoming job (or today's, if one is scheduled) — date, time, status, whether the crew has arrived yet. Use for 'are you coming today', 'when's my next appointment', etc.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_service_pricing",
    description: "Look up the starting price for a service by name (e.g. 'house wash', 'driveway'). Use for pricing questions.",
    input_schema: { type: "object", properties: { serviceName: { type: "string" } }, required: ["serviceName"] },
  },
  {
    name: "propose_reschedule",
    description: "Customer wants to move their appointment. Does NOT reschedule anything directly — checks how busy the requested new date already looks, then texts the OWNER a proposal for them to approve. Only use this after you have a specific requested date from the customer.",
    input_schema: {
      type: "object",
      properties: { requestedDate: { type: "string", description: "YYYY-MM-DD" }, requestedTime: { type: "string", description: "HH:MM, optional" } },
      required: ["requestedDate"],
    },
  },
];

const executeTool = async (ctx: Ctx, customer: any, name: string, input: Record<string, any>): Promise<any> => {
  try {
    switch (name) {
      case "get_my_appointment_status": {
        const jobs = await sbGet(ctx, `jobs?customerId=eq.${encodeURIComponent(customer.id)}&select=scheduledDate,scheduledTime,status,arrivedAt${ownerScope(ctx)}&status=neq.cancelled&order=scheduledDate.asc&limit=50`);
        const today = new Date().toISOString().slice(0, 10);
        const upcoming = jobs.filter((j: any) => j.scheduledDate >= today && j.status !== "completed");
        if (upcoming.length === 0) return { success: true, summary: "No upcoming appointment on file." };
        const next = upcoming[0];
        return { success: true, date: next.scheduledDate, time: next.scheduledTime, status: next.status, crewArrived: !!next.arrivedAt, isToday: next.scheduledDate === today };
      }
      case "get_service_pricing": {
        const rows = await sbGet(ctx, `services?select=name,price,description${ownerScope(ctx)}&limit=200`);
        const q = (input.serviceName || "").toLowerCase();
        const match = rows.find((s: any) => (s.name || "").toLowerCase().includes(q)) || rows.find((s: any) => q.includes((s.name || "").toLowerCase()));
        if (!match) return { error: "No matching service found — don't guess a price, tell the customer you'll have the owner follow up with a quote." };
        return { success: true, service: match.name, startingPrice: match.price, description: match.description };
      }
      case "propose_reschedule": {
        if (!input.requestedDate) return { error: "requestedDate required" };
        const jobs = await sbGet(ctx, `jobs?customerId=eq.${encodeURIComponent(customer.id)}&select=id,scheduledDate,scheduledTime,status${ownerScope(ctx)}&status=neq.completed&status=neq.cancelled&order=scheduledDate.asc&limit=10`);
        const job = jobs[0];
        if (!job) return { error: "No active appointment on file to reschedule — tell the customer to call/text the office directly." };
        const sameDayJobs = await sbGet(ctx, `jobs?scheduledDate=eq.${encodeURIComponent(input.requestedDate)}&select=id${ownerScope(ctx)}&status=neq.cancelled`);
        const looksBusy = sameDayJobs.length >= 6; // simple heuristic, not a real capacity model
        const row = {
          id: crypto.randomUUID(), owner_id: ctx.ownerId, customer_id: customer.id, job_id: job.id, kind: "reschedule",
          proposed: { fromDate: job.scheduledDate, fromTime: job.scheduledTime, toDate: input.requestedDate, toTime: input.requestedTime || "" },
          customer_phone: customer.phone, status: "pending", created_at: new Date().toISOString(),
        };
        await fetch(`${SUPABASE_URL}/rest/v1/alfred_pending_actions`, {
          method: "POST", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row),
        });
        const custName = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
        const proposalMsg = `📅 RESCHEDULE REQUEST: ${custName} wants to move their ${job.scheduledDate}${job.scheduledTime ? " " + job.scheduledTime : ""} appointment to ${input.requestedDate}${input.requestedTime ? " " + input.requestedTime : ""}.${looksBusy ? ` Heads up — ${sameDayJobs.length} jobs already on that day.` : " That day looks open."} Reply here to confirm or decline, or just tell Alfred "yes reschedule them" / "no, tell them that doesn't work."`;
        await sendSms(ctx, ctx.ownerPhone, proposalMsg);
        return { success: true, tellCustomer: true };
      }
      default:
        return { error: `Unknown tool "${name}".` };
    }
  } catch (e: any) {
    return { error: e?.message || "Tool failed." };
  }
};

const callModel = async (modelKey: string, apiKey: string, systemPrompt: string, messages: Array<{ role: string; content: any }>, tools: any[]): Promise<{ text: string; toolUses: Array<{ id: string; name: string; input: any }>; stopReason: string; raw: unknown }> => {
  const def = SMS_MODELS[modelKey];
  if (def.provider === "anthropic") {
    const res = await fetch(def.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: def.modelId, max_tokens: def.maxTokens, system: systemPrompt, messages, tools }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    const text = data.content?.find((b: any) => b.type === "text")?.text ?? "";
    const toolUses = (data.content ?? []).filter((b: any) => b.type === "tool_use").map((b: any) => ({ id: b.id, name: b.name, input: b.input ?? {} }));
    return { text, toolUses, stopReason: data.stop_reason ?? "end_turn", raw: data.content };
  }
  if (def.provider === "google") {
    const contents = messages.map((m: any) => {
      if (typeof m.content === "string") return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
      if (Array.isArray(m.content) && m.content[0]?.type === "tool_result") return { role: "user", parts: m.content.map((tr: any) => ({ functionResponse: { name: tr.tool_use_id, response: (() => { try { return JSON.parse(tr.content); } catch { return { result: tr.content }; } })() } })) };
      return { role: "model", parts: m.content };
    });
    const geminiTools = tools.length ? [{ functionDeclarations: tools.map((t: any) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }] : undefined;
    const res = await fetch(`${def.endpoint}?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents, ...(geminiTools ? { tools: geminiTools } : {}), generationConfig: { maxOutputTokens: def.maxTokens, thinkingConfig: { thinkingBudget: 0 } }, systemInstruction: { parts: [{ text: systemPrompt }] } }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p: any) => typeof p.text === "string").map((p: any) => p.text).join("");
    const toolUses = parts.filter((p: any) => p.functionCall).map((p: any) => ({ id: p.functionCall.name, name: p.functionCall.name, input: p.functionCall.args ?? {} }));
    return { text, toolUses, stopReason: toolUses.length ? "tool_use" : "end_turn", raw: parts.length ? parts : [{ text }] };
  }
  // openai-compat
  const openAiMessages = [{ role: "system", content: systemPrompt }, ...messages.map((m: any) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    if (Array.isArray(m.content) && m.content[0]?.type === "tool_result") return m.content.map((tr: any) => ({ role: "tool", tool_call_id: tr.tool_use_id, content: tr.content }));
    return m.content;
  }).flat()];
  const openAiTools = tools.length ? tools.map((t: any) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })) : undefined;
  const res = await fetch(def.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: def.modelId, max_tokens: def.maxTokens, messages: openAiMessages, ...(openAiTools ? { tools: openAiTools } : {}) }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as any;
  const choice = data.choices?.[0]?.message;
  const toolUses = (choice?.tool_calls ?? []).map((tc: any) => ({ id: tc.id, name: tc.function?.name, input: (() => { try { return JSON.parse(tc.function?.arguments || "{}"); } catch { return {}; } })() }));
  return { text: choice?.content ?? "", toolUses, stopReason: toolUses.length ? "tool_use" : "end_turn", raw: choice ?? { role: "assistant", content: "" } };
};

// Returns null if this text should NOT be auto-handled (e.g. no model
// configured) — caller falls back to normal "just log it for the owner"
// behavior in that case, never silently drops the message.
export const runAlfredCustomerAgent = async (
  ctx: Ctx,
  customer: any,
  modelKeys: Record<string, string>,
  modelPriority: string[] | undefined,
  incomingText: string,
): Promise<string | null> => {
  const chain = (modelPriority && modelPriority.length ? modelPriority : DEFAULT_PRIORITY).filter(m => SMS_MODELS[m] && !!modelKeys?.[m]);
  if (chain.length === 0) return null;

  const systemPrompt = `You are Alfred, texting on behalf of ${ctx.companyName} (a pressure-washing business) with an EXISTING CUSTOMER, ${customer.firstName || "the customer"}. Keep replies short and friendly (1-2 sentences, no markdown).

STRICT GUARDRAILS — these are not suggestions:
- You may answer general questions (pricing via get_service_pricing, their own appointment status via get_my_appointment_status) directly.
- You may NEVER reschedule, cancel, discount, or promise a specific new appointment time yourself. If they ask to reschedule, use propose_reschedule (requires a specific requested date) — this only proposes it to the OWNER for approval. After calling it, tell the customer something like "Let me check with the team and get back to you shortly!" — never confirm a new time yourself.
- If asked for anything you don't have a tool for (complaints, custom quotes, anything unusual), say you'll have the owner follow up personally — do not guess or improvise business decisions.
- Never discuss any OTHER customer, never reveal internal business details (revenue, other appointments, employee info).`;

  let finalText = "";
  for (const modelKey of chain) {
    const apiKey = modelKeys[modelKey];
    let convMessages: Array<{ role: string; content: any }> = [{ role: "user", content: incomingText }];
    let rounds = 0;
    let localFinal = "";
    let failed = false;
    while (rounds < 3) {
      rounds++;
      try {
        const result = await callModel(modelKey, apiKey, systemPrompt, convMessages, TOOLS);
        if (result.text) localFinal = result.text;
        if (result.toolUses.length > 0 && result.stopReason === "tool_use") {
          convMessages.push({ role: "assistant", content: result.raw });
          const results = await Promise.all(result.toolUses.map(async (tu) => ({
            type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(await executeTool(ctx, customer, tu.name, tu.input || {})),
          })));
          convMessages.push({ role: "user", content: results });
          continue;
        }
        break;
      } catch (e: any) {
        console.error(`[AlfredCustomerAgent] ${modelKey} failed:`, e?.message);
        failed = true;
        break;
      }
    }
    if (!failed) { finalText = localFinal; break; }
  }
  return finalText || "Thanks for reaching out — we'll get back to you shortly!";
};
