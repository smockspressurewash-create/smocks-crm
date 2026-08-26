// ─── Model definitions ─────────────────────────────────────────────────────────
// MODELS is a Record keyed by short name ("claude", "openai", etc.)
// `id` = short key (used in settings.activeModel, settings.modelKeys, priority arrays)
// `modelId` = actual API model ID sent in the request body

export interface ModelDef {
  id: string;           // Short key: "claude", "openai", etc.
  modelId: string;      // Actual API model ID: "claude-sonnet-4-20250514"
  name: string;
  label: string;
  provider: "anthropic" | "openai" | "google" | "groq" | "mistral" | "nvidia" | "openrouter";
  endpoint: string;
  maxTokens: number;
  contextWindow: number;
  color: string;
  needsKey: boolean;    // false = works without key (fails gracefully with clear error)
  supportsTools: boolean;
  keyUrl: string;
  apiLabel: string;
  free?: boolean;        // true = no cost to the user (shown with a "Free" badge)
}

export const MODELS: Record<string, ModelDef> = {
  claude: {
    id: "claude",
    modelId: "claude-sonnet-4-20250514",
    name: "Claude",
    label: "Claude Sonnet 4 (Recommended)",
    provider: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    maxTokens: 4096,
    contextWindow: 200000,
    color: "from-orange-500 to-orange-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://console.anthropic.com/",
    apiLabel: "Anthropic API Key",
  },
  openai: {
    id: "openai",
    modelId: "gpt-4o",
    name: "GPT-4o",
    label: "GPT-4o (OpenAI)",
    provider: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 128000,
    color: "from-green-500 to-green-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://platform.openai.com/api-keys",
    apiLabel: "OpenAI API Key",
  },
  gemini: {
    id: "gemini",
    modelId: "gemini-2.5-flash",
    name: "Gemini",
    label: "Gemini 2.5 Flash (Google)",
    provider: "google",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    maxTokens: 4096,
    contextWindow: 1000000,
    color: "from-blue-500 to-blue-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://aistudio.google.com/app/apikey",
    apiLabel: "Google AI API Key",
  },
  groq: {
    id: "groq",
    modelId: "llama-3.3-70b-versatile",
    name: "Groq",
    label: "Llama 3.3 70B via Groq",
    provider: "groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 128000,
    color: "from-purple-500 to-purple-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://console.groq.com/keys",
    apiLabel: "Groq API Key",
  },
  mistral: {
    id: "mistral",
    modelId: "mistral-large-latest",
    name: "Mistral",
    label: "Mistral Large",
    provider: "mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 128000,
    color: "from-red-500 to-pink-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://console.mistral.ai/api-keys/",
    apiLabel: "Mistral API Key",
  },
  // BUG FIX — "Kimi K2.6 gives a 404, and now it's gone from NVIDIA's
  // catalog entirely." Confirmed directly from NVIDIA's own build.nvidia.com
  // sample code (copied verbatim by the owner) — swapped for DeepSeek V4
  // Flash, a real current free model on their platform. Kept the same `id`
  // ("nvidia_kimi") so an owner who already had this slot in their saved
  // modelPriority doesn't need to re-add it — only what it actually points
  // at changed.
  nvidia_kimi: {
    id: "nvidia_kimi",
    modelId: "deepseek-ai/deepseek-v4-flash-0731",
    name: "DeepSeek V4 Flash",
    label: "DeepSeek V4 Flash (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 16384,
    contextWindow: 1000000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/deepseek-ai/deepseek-v4-flash-0731",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  // BUG FIX — swapped for the model the owner confirmed is actually live on
  // NVIDIA's catalog right now (nvidia/llama-3.1-nemotron-70b-instruct was
  // never verified and is very likely stale, same as Kimi K2.6 was).
  nvidia_nemotron: {
    id: "nvidia_nemotron",
    modelId: "nvidia/nemotron-3.5-lightning-30b-a3b",
    name: "Nemotron 3.5 Lightning",
    label: "Nemotron 3.5 Lightning 30B (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 16384,
    contextWindow: 128000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  nvidia_muse: {
    id: "nvidia_muse",
    modelId: "meta/muse-glimmer-30b",
    name: "Muse Glimmer 30B",
    label: "Muse Glimmer 30B (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 8192,
    contextWindow: 32000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    // Sample code didn't show tools/function-calling usage — leaving off
    // until confirmed, so Alfred's failover skips it for tool-using turns
    // rather than risk a model that silently ignores tool definitions.
    supportsTools: false,
    keyUrl: "https://build.nvidia.com/meta/muse-glimmer-30b",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  nvidia_deepseek_r1: {
    id: "nvidia_deepseek_r1",
    modelId: "deepseek-ai/deepseek-r1",
    name: "DeepSeek R1",
    label: "DeepSeek R1 (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 8192,
    contextWindow: 128000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/deepseek-ai/deepseek-r1",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  nvidia_qwen: {
    id: "nvidia_qwen",
    modelId: "qwen/qwen2.5-7b-instruct",
    name: "Qwen 2.5 7B",
    label: "Qwen 2.5 7B (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 32000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/qwen/qwen2_5-7b-instruct",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  openrouter: {
    id: "openrouter",
    modelId: "meta-llama/llama-3.3-70b-instruct:free",
    name: "OpenRouter",
    label: "OpenRouter (Llama 3.3 70B — Free via openrouter.ai)",
    provider: "openrouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 131072,
    color: "from-violet-500 to-purple-700",
    needsKey: true,
    supportsTools: false,
    keyUrl: "https://openrouter.ai/keys",
    apiLabel: "OpenRouter API Key",
    free: true,
  },
};

// ISSUE 19 — OpenRouter's free-tier catalog rotates/deprecates models often
// (a slug that works today 404s a few weeks later), which is exactly what
// was happening: the hardcoded modelId went stale and every call 404'd
// before ever reaching a usable model. This fallback list gives callModel's
// OpenRouter branch other free slugs to retry against on a 404 instead of
// failing outright — keep the primary modelId above first in this list.
export const OPENROUTER_FREE_FALLBACKS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemma-2-9b-it:free",
];

// BUG FIX — "check that OpenRouter API keys work for Alfred": every single
// hardcoded slug above 404'd in a real live test ("No endpoints found for
// google/gemma-2-9b-it:free" — the LAST one tried, meaning all five had
// already failed). Hand-maintaining this list doesn't hold up — OpenRouter's
// free catalog genuinely rotates on its own schedule, not ours. OpenRouter
// publishes its full model catalog at a public, unauthenticated, CORS-open
// endpoint specifically so integrations can do this instead of guessing —
// fetch it once per session, filter to models that are actually free right
// now (prompt AND completion pricing both "0"), and try those FIRST, with
// the static list above only as a last-resort fallback if that fetch
// itself fails (offline, OpenRouter's own outage, etc.).
let openRouterFreeModelsCache: string[] | null = null;
let openRouterFreeModelsFetchedAt = 0;
const OPENROUTER_CATALOG_TTL_MS = 30 * 60 * 1000;
const getOpenRouterFreeModels = async (): Promise<string[]> => {
  if (openRouterFreeModelsCache && Date.now() - openRouterFreeModelsFetchedAt < OPENROUTER_CATALOG_TTL_MS) {
    return openRouterFreeModelsCache;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }> };
    const free = (json.data || [])
      .filter(m => m.pricing?.prompt === "0" && m.pricing?.completion === "0")
      .map(m => m.id);
    if (free.length > 0) {
      openRouterFreeModelsCache = free;
      openRouterFreeModelsFetchedAt = Date.now();
      return free;
    }
    throw new Error("OpenRouter returned no free models");
  } catch (e: any) {
    console.warn("[OpenRouter] live free-model catalog fetch failed, using static fallback list:", e?.message);
    return [];
  }
};

// ─── Safe fetch ───────────────────────────────────────────────────────────────

// BUG FIX — "it shouldn't show that type of error; it should just say a
// plain-text English error." A failed provider call used to surface its
// raw HTTP status + response body verbatim in the chat — a JSON:API-style
// error object (some providers, NVIDIA's NIM platform in particular,
// return structured `{status, title, detail}` bodies) showed up as a
// literal unreadable JSON blob. Pull the actual human-readable message out
// of whatever shape the provider used before falling back to the raw text.
const extractErrorMessage = (text: string, status: number): string => {
  try {
    const j = JSON.parse(text);
    const msg = j?.detail || j?.error?.message || j?.error || j?.message || j?.title;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch { /* not JSON — fall through to raw text */ }
  return text.slice(0, 200) || `Request failed (${status})`;
};

export const safeFetch = async (url: string, opts: RequestInit): Promise<unknown> => {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status}: ${extractErrorMessage(text, res.status)}`);
    (err as any).status = res.status;
    (err as any).retryAfter = res.headers.get("retry-after");
    throw err;
  }
  return res.json();
};

// ─── Rate limit error parser ──────────────────────────────────────────────────
// Returns { lockedUntil: timestamp } on a rate-limit/quota error, or null.

export const parseRateLimitError = (
  err: unknown,
  _modelId?: string,
): { lockedUntil: number } | null => {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as any)?.status as number | undefined;
  if (
    status === 429 ||
    msg.includes("429") ||
    /rate.?limit|quota.?exceed|too many requests/i.test(msg)
  ) {
    const rawRetry = (err as any)?.retryAfter as string | undefined;
    const seconds = rawRetry ? Math.max(10, parseInt(rawRetry, 10) || 60) : 60;
    return { lockedUntil: Date.now() + seconds * 1000 };
  }
  return null;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CallModelResult {
  text: string;
  toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  stopReason: string;
  raw: unknown;
}

// ─── Unified model caller ─────────────────────────────────────────────────────
// Called by AlfredPage with: { modelId, apiKey, systemPrompt, messages, tools, maxTokens }

export const callModel = async (opts: {
  modelId: string;
  apiKey?: string;
  systemPrompt?: string;
  messages: Array<{ role: string; content: unknown }>;
  tools?: unknown[];
  maxTokens?: number;
}): Promise<CallModelResult> => {
  const def = MODELS[opts.modelId];
  if (!def) throw new Error(`Unknown model key: "${opts.modelId}". Valid keys: ${Object.keys(MODELS).join(", ")}`);

  const maxTokens = opts.maxTokens ?? def.maxTokens;
  const apiKey = opts.apiKey ?? "";

  // ── Anthropic ──────────────────────────────────────────────────────────────
  if (def.provider === "anthropic") {
    if (!apiKey) {
      throw new Error(
        "No Anthropic API key set.\n\n" +
        "To use Alfred:\n" +
        "1. Go to Settings → AI Models\n" +
        "2. Paste your Anthropic API key (get one at console.anthropic.com)\n\n" +
        "Slash commands (/status, /route, /rollcall, etc.) still work without a key."
      );
    }

    const body: Record<string, unknown> = {
      model: def.modelId,
      max_tokens: maxTokens,
      messages: opts.messages,
    };
    if (opts.systemPrompt) body.system = opts.systemPrompt;
    if (opts.tools?.length) body.tools = opts.tools;

    const data = await safeFetch(def.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    }) as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      stop_reason?: string;
    };

    const text = data.content?.find(b => b.type === "text")?.text ?? "";
    const toolUses = (data.content ?? [])
      .filter(b => b.type === "tool_use")
      .map(b => ({ id: b.id!, name: b.name!, input: b.input ?? {} }));

    return { text, toolUses, stopReason: data.stop_reason ?? "end_turn", raw: data.content };
  }

  // ── Google Gemini ──────────────────────────────────────────────────────────
  // Tool definitions arrive in Anthropic's shape ({name, description,
  // input_schema}) — input_schema is already plain JSON Schema, which is
  // exactly what Gemini's functionDeclarations.parameters expects too, so no
  // restructuring is needed beyond the key rename.
  if (def.provider === "google") {
    if (!apiKey) throw new Error("No Google AI API key — add one in Settings → AI Models.");

    // Within one model's attempt (see AlfredPage's tool loop), a message's
    // content is always one of: a plain string (the original chat history),
    // the generic {type:"tool_result", tool_use_id, content}[] array
    // AlfredPage builds after running tools, or this SAME branch's own
    // previously-returned `raw` parts array pushed back verbatim as the
    // model's turn — never a shape from a different provider, since each
    // failover attempt resets the conversation from scratch.
    const contents = opts.messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => {
        if (typeof m.content === "string") {
          return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
        }
        if (Array.isArray(m.content) && (m.content as any[])[0]?.type === "tool_result") {
          // Gemini correlates function responses by name, not a call id, so
          // the toolUses below uses the function name as its "id" — read
          // it back here as the functionResponse's name.
          const parts = (m.content as Array<{ tool_use_id: string; content: string }>).map(tr => ({
            functionResponse: {
              name: tr.tool_use_id,
              response: (() => { try { return JSON.parse(tr.content); } catch { return { result: tr.content }; } })(),
            },
          }));
          return { role: "user", parts };
        }
        if (Array.isArray(m.content)) {
          // Our own previously-returned parts array (text and/or functionCall).
          return { role: "model", parts: m.content };
        }
        return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] };
      });

    const geminiTools = opts.tools?.length
      ? [{ functionDeclarations: (opts.tools as Array<{ name: string; description: string; input_schema: unknown }>).map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }]
      : undefined;

    const url = `${def.endpoint}?key=${apiKey}`;
    const data = await safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(geminiTools ? { tools: geminiTools } : {}),
        // Disable thinking for tool-calling: gemini-2.5-flash defaults to
        // spending part (sometimes all) of maxOutputTokens on invisible
        // reasoning before emitting text/functionCall parts. With a 1500-
        // token cap and 25+ tool definitions in the system prompt, that can
        // exhaust the whole budget and finish with empty parts (finishReason
        // MAX_TOKENS) — matching the observed stopReason:"end_turn" with
        // both text and toolUses empty. Tool-calling doesn't need visible
        // chain-of-thought, so budget=0 removes the failure mode entirely.
        generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
        ...(opts.systemPrompt ? { systemInstruction: { parts: [{ text: opts.systemPrompt }] } } : {}),
      }),
    }) as { candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> }; finishReason?: string; safetyRatings?: unknown }>; promptFeedback?: { blockReason?: string; safetyRatings?: unknown } };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter(p => typeof p.text === "string" && p.text).map(p => p.text as string).join("");
    const toolUses = parts
      .filter(p => p.functionCall)
      .map(p => {
        const fc = p.functionCall as { name: string; args?: Record<string, unknown> };
        return { id: fc.name, name: fc.name, input: fc.args ?? {} };
      });
    const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
    console.log(
      "[Gemini] finishReason:", data.candidates?.[0]?.finishReason,
      "· partKinds:", parts.map(p => Object.keys(p).join("+")),
      "· promptFeedback:", data.promptFeedback,
      "· safetyRatings:", data.candidates?.[0]?.safetyRatings,
      "· raw response (first 500 chars):", JSON.stringify(data).slice(0, 500)
    );
    // raw must be non-empty parts so pushing it back as the next model turn
    // is valid — Gemini rejects a content object with an empty parts array.
    return { text, toolUses, stopReason, raw: parts.length ? parts : [{ text }] };
  }

  // ── OpenAI-compatible (OpenAI, Groq, Mistral, NVIDIA) ──────────────────────
  // Standard OpenAI tools/tool_calls format, shared verbatim by Groq, Mistral,
  // and NVIDIA's NIM endpoint (integrate.api.nvidia.com) since all three mirror
  // OpenAI's chat completions API. NVIDIA keys are issued already prefixed
  // ("nvapi-...") — that prefix is part of the key string itself, so sending
  // `Authorization: Bearer ${apiKey}` (same as every other provider here)
  // produces the correct "Bearer nvapi-..." header with no special-casing.
  if (!apiKey) {
    const hint = def.provider === "nvidia"
      ? ` Get a free key at ${def.keyUrl} — it should start with "nvapi-".`
      : "";
    throw new Error(`No ${def.name} API key — add one in Settings → AI Models.${hint}`);
  }

  const openAiMessages: Array<Record<string, unknown>> = [
    ...(opts.systemPrompt ? [{ role: "system", content: opts.systemPrompt }] : []),
  ];
  for (const m of opts.messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (typeof m.content === "string") {
      openAiMessages.push({ role: m.role, content: m.content });
    } else if (Array.isArray(m.content) && (m.content as any[])[0]?.type === "tool_result") {
      // OpenAI wants one "tool" message per result, keyed by tool_call_id —
      // unlike Gemini, which batches them into one functionResponse turn.
      for (const tr of m.content as Array<{ tool_use_id: string; content: string }>) {
        openAiMessages.push({ role: "tool", tool_call_id: tr.tool_use_id, content: tr.content });
      }
    } else if (m.role === "assistant" && m.content && typeof m.content === "object" && !Array.isArray(m.content)) {
      // Our own previously-returned raw assistant message (content + tool_calls).
      openAiMessages.push(m.content as Record<string, unknown>);
    } else if (Array.isArray(m.content)) {
      const text = (m.content as Array<{ type: string; text?: string }>).filter(b => b.type === "text").map(b => b.text ?? "").join("");
      openAiMessages.push({ role: m.role, content: text });
    } else {
      openAiMessages.push({ role: m.role, content: String(m.content) });
    }
  }

  const openAiTools = opts.tools?.length
    ? (opts.tools as Array<{ name: string; description: string; input_schema: unknown }>).map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }))
    : undefined;

  const openAiHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    // ISSUE 19 — OpenRouter attributes/ranks requests by these headers; some
    // free-tier models 404 or get deprioritized for requests missing them.
    ...(def.provider === "openrouter" ? { "HTTP-Referer": "https://crewboss.app", "X-Title": "CrewBoss CRM" } : {}),
  };

  // ISSUE 19 — see OPENROUTER_FREE_FALLBACKS: try each candidate model in
  // order, moving to the next only on a 404 (model gone/renamed), not on
  // other errors (auth, rate-limit, etc. should surface immediately). Live
  // catalog first (see getOpenRouterFreeModels), static list as backup —
  // deduped, live results first.
  let modelCandidates: string[];
  if (def.provider === "openrouter") {
    const live = await getOpenRouterFreeModels();
    // Cap the list — trying every free model on the whole catalog one at a
    // time on repeated 404s could take a while; the first several already
    // give good odds of hitting a working one.
    modelCandidates = Array.from(new Set([...live, ...OPENROUTER_FREE_FALLBACKS])).slice(0, 8);
  } else {
    modelCandidates = [def.modelId];
  }

  let data: { choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; function?: { name: string; arguments?: string } }> } }> } | undefined;
  let lastErr: unknown;
  for (const candidateModel of modelCandidates) {
    const openAiBody = JSON.stringify({
      model: candidateModel,
      max_tokens: maxTokens,
      messages: openAiMessages,
      ...(openAiTools ? { tools: openAiTools } : {}),
    });
    try {
      data = await safeFetch(def.endpoint, { method: "POST", headers: openAiHeaders, body: openAiBody }) as typeof data;
      lastErr = undefined;
      break;
    } catch (err) {
      // On a network/CORS error (TypeError: Failed to fetch), retry through
      // this app's own same-origin proxy (functions/api/ai-proxy.ts) —
      // used to be a public third-party proxy (corsproxy.io), which is now
      // returning 403 Forbidden on every request (verified live) and was
      // sending the user's API key to an unrelated service. NVIDIA's NIM
      // API in particular sets NO CORS headers at all (verified live), so
      // every NVIDIA call takes this path, every time — this is the actual
      // reason NVIDIA models "don't work": there was no working fallback.
      if (err instanceof TypeError) {
        try {
          data = await safeFetch("/api/ai-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: def.endpoint, headers: openAiHeaders, body: openAiBody }),
          }) as typeof data;
          lastErr = undefined;
          break;
        } catch (proxyErr) {
          lastErr = proxyErr;
        }
      } else if ((err as any)?.status === 404 && modelCandidates.length > 1) {
        console.warn(`[OpenRouter] model "${candidateModel}" 404'd — trying next fallback`);
        lastErr = err;
        continue;
      } else {
        throw err;
      }
    }
  }
  if (!data) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));

  const choice = data.choices?.[0]?.message;
  const text = choice?.content ?? "";
  const toolUses = (choice?.tool_calls ?? []).map(tc => ({
    id: tc.id,
    name: tc.function?.name ?? "",
    input: (() => { try { return JSON.parse(tc.function?.arguments || "{}"); } catch { return {}; } })(),
  }));
  const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
  return { text, toolUses, stopReason, raw: choice ?? { role: "assistant", content: text } };
};
