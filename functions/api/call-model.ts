// SECURITY FIX — moves the actual AI-provider API call server-side so the
// real API key never has to live in browser-readable state again. Every AI
// model key (Claude/OpenAI/Gemini/Groq/Mistral/NVIDIA/OpenRouter) used to
// live in app_settings.data (JSONB), readable by every one of an owner's own
// signed-in employees — see migration 0085's comment for the full story.
// This is a server-side port of lib/api.ts's callModel — same provider
// dispatch logic, same request/response shape — with the key resolved here
// via owner_secrets instead of accepted from the client. lib/api.ts's own
// callModel is now a thin authenticated proxy to this endpoint, so every
// existing call site (AlfredPage.tsx, EmployeePortal.tsx's voice-checklist
// AI match, VisualWorkflowBuilder.tsx's AI Draft) needed ZERO changes.
//
// Usable by any authenticated CRM session (owner OR employee) — Alfred and
// the voice-checklist feature are both already legitimately used by
// employees today; the point of this fix is hiding the KEY, not restricting
// who gets to use the AI features it powers (same reasoning as Twilio SMS
// sending already being employee-usable via twilio-send.ts).

import { getOwnerSecrets, resolveCallerOwnerId } from "./_lib/ownerSecrets";

type ModelDef = { modelId: string; provider: "anthropic" | "openai" | "google" | "groq" | "mistral" | "nvidia" | "openrouter"; endpoint: string };

// Minimal mirror of src/lib/api.ts's MODELS — only the fields this proxy
// actually needs (provider/endpoint/modelId), duplicated rather than
// cross-imported since Cloudflare Pages Functions build separately from the
// Vite app under src/. Keep in sync with src/lib/api.ts's MODELS if a model
// is added/renamed/removed there.
const MODELS: Record<string, ModelDef> = {
  claude: { modelId: "claude-sonnet-4-20250514", provider: "anthropic", endpoint: "https://api.anthropic.com/v1/messages" },
  openai: { modelId: "gpt-4o", provider: "openai", endpoint: "https://api.openai.com/v1/chat/completions" },
  gemini: { modelId: "gemini-2.5-flash", provider: "google", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" },
  groq: { modelId: "llama-3.3-70b-versatile", provider: "groq", endpoint: "https://api.groq.com/openai/v1/chat/completions" },
  mistral: { modelId: "mistral-large-latest", provider: "mistral", endpoint: "https://api.mistral.ai/v1/chat/completions" },
  nvidia_kimi: { modelId: "deepseek-ai/deepseek-v4-flash-0731", provider: "nvidia", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  nvidia_nemotron: { modelId: "nvidia/nemotron-3.5-lightning-30b-a3b", provider: "nvidia", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  nvidia_muse: { modelId: "meta/muse-glimmer-30b", provider: "nvidia", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  nvidia_deepseek_r1: { modelId: "deepseek-ai/deepseek-r1", provider: "nvidia", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  nvidia_qwen: { modelId: "qwen/qwen2.5-7b-instruct", provider: "nvidia", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  openrouter: { modelId: "z-ai/glm-5.2:free", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions" },
};

const OPENROUTER_FREE_FALLBACKS = [
  "z-ai/glm-5.2:free",
  "minimax/minimax-m3:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3.5-lightning:free",
];

let openRouterFreeModelsCache: string[] | null = null;
let openRouterFreeModelsFetchedAt = 0;
const OPENROUTER_CATALOG_TTL_MS = 30 * 60 * 1000;
const getOpenRouterFreeModels = async (): Promise<string[]> => {
  if (openRouterFreeModelsCache && Date.now() - openRouterFreeModelsFetchedAt < OPENROUTER_CATALOG_TTL_MS) return openRouterFreeModelsCache;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json() as { data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string }; supported_parameters?: string[] }> };
    const free = (j.data || [])
      .filter(m => m.pricing?.prompt === "0" && m.pricing?.completion === "0")
      .filter(m => (m.supported_parameters || []).includes("tools") || (m.supported_parameters || []).includes("tool_choice"))
      .map(m => m.id);
    if (free.length > 0) { openRouterFreeModelsCache = free; openRouterFreeModelsFetchedAt = Date.now(); return free; }
    throw new Error("no free tool-capable models");
  } catch { return []; }
};

const extractErrorMessage = (text: string, status: number): string => {
  try {
    const j = JSON.parse(text);
    const msg = j?.detail || j?.error?.message || j?.error || j?.message || j?.title;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch { /* not JSON */ }
  return text.slice(0, 200) || `Request failed (${status})`;
};

const safeFetch = async (url: string, opts: RequestInit): Promise<any> => {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status}: ${extractErrorMessage(text, res.status)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var." }, 500);
  try {
    const body = await context.request.json() as {
      modelId: string; systemPrompt?: string; messages: Array<{ role: string; content: unknown }>;
      tools?: unknown[]; maxTokens?: number;
    };
    const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const ownerId = await resolveCallerOwnerId(accessToken);
    if (!ownerId) return json({ error: "Not signed in." }, 401);

    const def = MODELS[body.modelId];
    if (!def) return json({ error: `Unknown model key: "${body.modelId}"` }, 400);
    const secrets = await getOwnerSecrets(ownerId, serviceRoleKey);
    const apiKey = secrets?.modelKeys?.[body.modelId] || "";
    const maxTokens = body.maxTokens ?? 4096;

    if (def.provider === "anthropic") {
      if (!apiKey) return json({ error: "No Anthropic API key set. Go to Settings → AI Models and paste your Anthropic API key." }, 400);
      const reqBody: Record<string, unknown> = { model: def.modelId, max_tokens: maxTokens, messages: body.messages };
      if (body.systemPrompt) reqBody.system = body.systemPrompt;
      if (body.tools?.length) reqBody.tools = body.tools;
      const data = await safeFetch(def.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(reqBody),
      });
      const text = data.content?.find((b: any) => b.type === "text")?.text ?? "";
      const toolUses = (data.content ?? []).filter((b: any) => b.type === "tool_use").map((b: any) => ({ id: b.id, name: b.name, input: b.input ?? {} }));
      return json({ text, toolUses, stopReason: data.stop_reason ?? "end_turn", raw: data.content });
    }

    if (def.provider === "google") {
      if (!apiKey) return json({ error: "No Google AI API key — add one in Settings → AI Models." }, 400);
      const contents = body.messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => {
          if (typeof m.content === "string") return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
          if (Array.isArray(m.content) && (m.content as any[])[0]?.type === "tool_result") {
            const parts = (m.content as Array<{ tool_use_id: string; content: string }>).map(tr => ({
              functionResponse: { name: tr.tool_use_id, response: (() => { try { return JSON.parse(tr.content); } catch { return { result: tr.content }; } })() },
            }));
            return { role: "user", parts };
          }
          if (Array.isArray(m.content)) return { role: "model", parts: m.content };
          return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] };
        });
      const geminiTools = body.tools?.length
        ? [{ functionDeclarations: (body.tools as Array<{ name: string; description: string; input_schema: unknown }>).map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }]
        : undefined;
      const url = `${def.endpoint}?key=${apiKey}`;
      const data = await safeFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          ...(geminiTools ? { tools: geminiTools } : {}),
          generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
          ...(body.systemPrompt ? { systemInstruction: { parts: [{ text: body.systemPrompt }] } } : {}),
        }),
      });
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts.filter((p: any) => typeof p.text === "string" && p.text).map((p: any) => p.text).join("");
      const toolUses = parts.filter((p: any) => p.functionCall).map((p: any) => ({ id: p.functionCall.name, name: p.functionCall.name, input: p.functionCall.args ?? {} }));
      const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
      return json({ text, toolUses, stopReason, raw: parts.length ? parts : [{ text }] });
    }

    // ── OpenAI-compatible (OpenAI, Groq, Mistral, NVIDIA, OpenRouter) ──────
    if (!apiKey) {
      const hint = def.provider === "nvidia" ? ` Get a free key and add it in Settings → AI Models — it should start with "nvapi-".` : "";
      return json({ error: `No API key set for this model.${hint} Add one in Settings → AI Models.` }, 400);
    }
    const openAiMessages: Array<Record<string, unknown>> = [...(body.systemPrompt ? [{ role: "system", content: body.systemPrompt }] : [])];
    for (const m of body.messages) {
      if (m.role !== "user" && m.role !== "assistant") continue;
      if (typeof m.content === "string") openAiMessages.push({ role: m.role, content: m.content });
      else if (Array.isArray(m.content) && (m.content as any[])[0]?.type === "tool_result") {
        for (const tr of m.content as Array<{ tool_use_id: string; content: string }>) openAiMessages.push({ role: "tool", tool_call_id: tr.tool_use_id, content: tr.content });
      } else if (m.role === "assistant" && m.content && typeof m.content === "object" && !Array.isArray(m.content)) {
        openAiMessages.push(m.content as Record<string, unknown>);
      } else if (Array.isArray(m.content)) {
        const text = (m.content as Array<{ type: string; text?: string }>).filter(b => b.type === "text").map(b => b.text ?? "").join("");
        openAiMessages.push({ role: m.role, content: text });
      } else openAiMessages.push({ role: m.role, content: String(m.content) });
    }
    const openAiTools = body.tools?.length
      ? (body.tools as Array<{ name: string; description: string; input_schema: unknown }>).map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }))
      : undefined;
    const openAiHeaders: Record<string, string> = {
      "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`,
      ...(def.provider === "openrouter" ? { "HTTP-Referer": "https://crewboss.app", "X-Title": "CrewBoss CRM" } : {}),
    };
    let modelCandidates: string[];
    if (def.provider === "openrouter") {
      const live = await getOpenRouterFreeModels();
      modelCandidates = Array.from(new Set([...live, ...OPENROUTER_FREE_FALLBACKS])).slice(0, 8);
    } else modelCandidates = [def.modelId];

    let data: any;
    let lastErr: unknown;
    for (const candidateModel of modelCandidates) {
      const openAiBody = JSON.stringify({ model: candidateModel, max_tokens: maxTokens, messages: openAiMessages, ...(openAiTools ? { tools: openAiTools } : {}) });
      try {
        data = await safeFetch(def.endpoint, { method: "POST", headers: openAiHeaders, body: openAiBody });
        lastErr = undefined;
        break;
      } catch (err: any) {
        if (err?.status === 404 && modelCandidates.length > 1) { lastErr = err; continue; }
        throw err;
      }
    }
    if (!data) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    const choice = data.choices?.[0]?.message;
    const text = choice?.content ?? "";
    const toolUses = (choice?.tool_calls ?? []).map((tc: any) => ({ id: tc.id, name: tc.function?.name ?? "", input: (() => { try { return JSON.parse(tc.function?.arguments || "{}"); } catch { return {}; } })() }));
    const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
    return json({ text, toolUses, stopReason, raw: choice ?? { role: "assistant", content: text } });
  } catch (e: any) {
    return json({ error: e?.message || "call-model proxy error" }, e?.status || 500);
  }
};
