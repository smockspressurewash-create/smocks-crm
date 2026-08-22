// alfredEmployeeAgent.ts — a THIRD, separate Alfred agent (alongside the
// owner-facing alfredSmsAgent.ts and the customer-facing
// alfredCustomerAgent.ts) for employees the owner has explicitly opted in
// to texting Alfred (employees.permissions.can_text_alfred — off by
// default, toggled per-employee in Settings/Employees, same pattern as
// customers."alfredAutoRespond").
//
// Deliberately narrow, matching alfredCustomerAgent.ts's philosophy: this
// employee can only ever act on THEIR OWN record — clock themselves in/out,
// check their own hours, see their own upcoming jobs, manage events on
// THEIR OWN connected Google Calendar. No tool here takes an employeeId/
// employeeName the model could substitute to act as someone else, and
// nothing here touches other employees, customers, money, or CRM-wide data.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const SMS_MODELS: Record<string, { provider: string; modelId: string; endpoint: string; maxTokens: number }> = {
  claude: { provider: "anthropic", modelId: "claude-sonnet-4-20250514", endpoint: "https://api.anthropic.com/v1/messages", maxTokens: 400 },
  openai: { provider: "openai-compat", modelId: "gpt-4o", endpoint: "https://api.openai.com/v1/chat/completions", maxTokens: 400 },
  gemini: { provider: "google", modelId: "gemini-2.5-flash", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", maxTokens: 400 },
  groq: { provider: "openai-compat", modelId: "llama-3.3-70b-versatile", endpoint: "https://api.groq.com/openai/v1/chat/completions", maxTokens: 400 },
  mistral: { provider: "openai-compat", modelId: "mistral-large-latest", endpoint: "https://api.mistral.ai/v1/chat/completions", maxTokens: 400 },
  nvidia_kimi: { provider: "openai-compat", modelId: "moonshotai/kimi-k2.6", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", maxTokens: 400 },
};
const DEFAULT_PRIORITY = ["claude", "openai", "gemini", "groq", "mistral"];

export type Ctx = {
  authHeaders: Record<string, string>;
  ownerId: string | null;
  companyName: string;
  origin: string;
  env: Record<string, string>;
};

const sbGet = async (ctx: Ctx, path: string): Promise<any[]> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: ctx.authHeaders });
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
};
const ownerScope = (ctx: Ctx) => (ctx.ownerId ? `&owner_id=eq.${encodeURIComponent(ctx.ownerId)}` : "");
const shiftDayStr = () => new Date().toISOString().slice(0, 10);

const TOOLS = [
  {
    name: "clock_in",
    description: "Clock the employee in for the day (starts their shift timer). Use for 'clock me in' / 'I'm starting my shift'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "clock_out",
    description: "Clock the employee out, ending their shift for the day and logging the hours worked. Use for 'clock me out' / 'I'm done for the day'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_my_hours",
    description: "Check current shift status and hours — whether clocked in right now (and for how long), plus their most recently completed shift. Use for 'how many hours have I worked' / 'am I clocked in'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_my_upcoming_jobs",
    description: "List THIS employee's own upcoming assigned jobs. Use for 'what's on my schedule' / 'what job am I on next'.",
    input_schema: { type: "object", properties: { days: { type: "number", description: "how many days forward, default 7" } } },
  },
  {
    name: "add_my_calendar_event",
    description: "Add an event to THIS employee's own connected Google Calendar (personal, not a CRM job). Only works if they've connected Google from their portal.",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h" }, durationMinutes: { type: "number" }, notes: { type: "string" } },
      required: ["title", "date", "time"],
    },
  },
  {
    name: "delete_my_calendar_event",
    description: "Delete an event from this employee's own Google Calendar, found by title.",
    input_schema: { type: "object", properties: { title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD, narrows the search" } }, required: ["title"] },
  },
];

const getEmployeeGoogleToken = async (ctx: Ctx, employee: any): Promise<string | null> => {
  if (!employee.google_refresh_token && !employee.google_token) return null;
  let accessToken = employee.google_token || "";
  if (employee.google_refresh_token && (!employee.google_token_expires_at || Date.now() > Number(employee.google_token_expires_at) - 60000)) {
    try {
      const refreshRes = await fetch(`${ctx.origin}/api/google-refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: employee.google_refresh_token }),
      });
      const data = await refreshRes.json().catch(() => null) as any;
      if (refreshRes.ok && data?.access_token) accessToken = data.access_token;
    } catch { /* fall through with whatever token we have */ }
  }
  return accessToken || null;
};

const executeTool = async (ctx: Ctx, employee: any, name: string, input: Record<string, any>): Promise<any> => {
  try {
    switch (name) {
      case "clock_in": {
        if (employee.dayClockInAt) return { error: "Already clocked in for today." };
        const patch = { dayClockInAt: Date.now(), dayLunchStartAt: null, dayPausedMinutes: 0 };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/employees?id=eq.${encodeURIComponent(employee.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(patch),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, clockedInAt: patch.dayClockInAt };
      }
      case "clock_out": {
        if (!employee.dayClockInAt) return { error: "Not currently clocked in." };
        const elapsedMs = Date.now() - Number(employee.dayClockInAt) - (Number(employee.dayPausedMinutes) || 0) * 60000;
        const hours = Math.round((elapsedMs / 3600000) * 100) / 100;
        const patch = { dayClockInAt: null, dayLunchStartAt: null, dayPausedMinutes: 0, lastShiftHours: hours, lastShiftDate: shiftDayStr() };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/employees?id=eq.${encodeURIComponent(employee.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(patch),
        });
        if (!res.ok) {
          // Safe-column retry (CLAUDE.md) — lastShiftHours/lastShiftDate may
          // not exist on an older deployment; dayClockInAt must still clear.
          const core = { dayClockInAt: null, dayLunchStartAt: null, dayPausedMinutes: 0 };
          const retry = await fetch(`${SUPABASE_URL}/rest/v1/employees?id=eq.${encodeURIComponent(employee.id)}`, {
            method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(core),
          });
          if (!retry.ok) return { error: (await retry.text().catch(() => "")).slice(0, 200) };
        }
        return { success: true, hoursWorked: hours };
      }
      case "get_my_hours": {
        if (employee.dayClockInAt) {
          const elapsedMs = Date.now() - Number(employee.dayClockInAt) - (Number(employee.dayPausedMinutes) || 0) * 60000;
          return { success: true, clockedIn: true, hoursSoFarToday: Math.round((elapsedMs / 3600000) * 100) / 100 };
        }
        return { success: true, clockedIn: false, lastShiftHours: employee.lastShiftHours ?? null, lastShiftDate: employee.lastShiftDate ?? null };
      }
      case "list_my_upcoming_jobs": {
        const days = Math.max(1, Math.min(30, Number(input.days) || 7));
        const start = new Date().toISOString().slice(0, 10);
        const end = new Date(); end.setDate(end.getDate() + days);
        const rows = await sbGet(ctx, `jobs?select=id,customerName,status,scheduledDate,scheduledTime,address${ownerScope(ctx)}&scheduledDate=gte.${start}&scheduledDate=lt.${end.toISOString().slice(0, 10)}&limit=200`);
        const mine = rows.filter((j: any) => Array.isArray(j.crew) ? j.crew.includes(employee.id) : false).filter((j: any) => j.status !== "cancelled" && j.status !== "completed");
        if (mine.length === 0) return { success: true, jobs: [], summary: "Nothing on your schedule in that window." };
        return { success: true, jobs: mine.sort((a: any, b: any) => (a.scheduledDate + (a.scheduledTime || "")).localeCompare(b.scheduledDate + (b.scheduledTime || ""))).map((j: any) => ({ date: j.scheduledDate, time: j.scheduledTime, customer: j.customerName, address: j.address })) };
      }
      case "add_my_calendar_event": {
        const token = await getEmployeeGoogleToken(ctx, employee);
        if (!token) return { error: "You haven't connected Google Calendar — connect it from your portal's Google tab first." };
        const startDate = new Date(`${input.date}T${input.time}:00`);
        if (isNaN(startDate.getTime())) return { error: "Couldn't parse that date/time." };
        const endDate = new Date(startDate.getTime() + (Number(input.durationMinutes) || 60) * 60000);
        const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ summary: input.title, description: input.notes || "", start: { dateTime: startDate.toISOString() }, end: { dateTime: endDate.toISOString() } }),
        });
        if (!res.ok) return { error: "Google Calendar error: " + (await res.text().catch(() => "")).slice(0, 200) };
        const data = await res.json().catch(() => null) as any;
        return { success: true, eventId: data?.id, title: input.title };
      }
      case "delete_my_calendar_event": {
        const token = await getEmployeeGoogleToken(ctx, employee);
        if (!token) return { error: "You haven't connected Google Calendar." };
        const now = new Date(); const farOut = new Date(now.getTime() + 90 * 24 * 3600000);
        const listRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now.toISOString())}&timeMax=${encodeURIComponent(farOut.toISOString())}&singleEvents=true&maxResults=100`, { headers: { Authorization: `Bearer ${token}` } });
        const listData = await listRes.json().catch(() => null) as any;
        const q = String(input.title || "").toLowerCase();
        const match = (listData?.items || []).find((ev: any) => (ev.summary || "").toLowerCase().includes(q) && (!input.date || (ev.start?.dateTime || ev.start?.date || "").slice(0, 10) === input.date));
        if (!match) return { error: `No event found matching "${input.title}".` };
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(match.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        return { success: true, deleted: true };
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

export const runAlfredEmployeeAgent = async (
  ctx: Ctx,
  employee: any,
  modelKeys: Record<string, string>,
  modelPriority: string[] | undefined,
  incomingText: string,
): Promise<string> => {
  const chain = (modelPriority && modelPriority.length ? modelPriority : DEFAULT_PRIORITY).filter(m => SMS_MODELS[m] && !!modelKeys?.[m]);
  if (chain.length === 0) return "Alfred over text isn't set up yet — ask your boss to add an AI model API key in Settings → AI Models.";

  const systemPrompt = `You are Alfred, texting with ${employee.firstName || "an employee"}, a member of the ${ctx.companyName} crew. Keep replies short (this is a text, 1-3 sentences, no markdown).

You can ONLY act on THIS employee's own record — never mention or look up other employees, customers, financials, or business-wide data, you don't have tools for any of that here. You can: clock them in/out (clock_in/clock_out), check their hours (get_my_hours), list their own upcoming jobs (list_my_upcoming_jobs), and add/delete events on their own connected Google Calendar (add_my_calendar_event/delete_my_calendar_event — tell them to connect it from their portal's Google tab if not connected). If a tool result has an "error", tell them exactly what went wrong — never claim something succeeded unless the tool actually said so.`;

  let finalText = "";
  for (const modelKey of chain) {
    const apiKey = modelKeys[modelKey];
    let convMessages: Array<{ role: string; content: any }> = [{ role: "user", content: incomingText }];
    let rounds = 0;
    let localFinal = "";
    let failed = false;
    while (rounds < 6) {
      rounds++;
      try {
        const result = await callModel(modelKey, apiKey, systemPrompt, convMessages, TOOLS);
        if (result.text) localFinal = result.text;
        if (result.toolUses.length > 0 && result.stopReason === "tool_use") {
          convMessages.push({ role: "assistant", content: result.raw });
          const results = await Promise.all(result.toolUses.map(async (tu) => ({
            type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(await executeTool(ctx, employee, tu.name, tu.input || {})),
          })));
          convMessages.push({ role: "user", content: results });
          continue;
        }
        break;
      } catch (e: any) {
        console.error(`[AlfredEmployeeAgent] ${modelKey} failed:`, e?.message);
        failed = true;
        break;
      }
    }
    if (!failed) { finalText = localFinal; break; }
  }
  return finalText || "Got it.";
};
