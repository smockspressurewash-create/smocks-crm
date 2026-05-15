// ─── Model definitions ─────────────────────────────────────────────────────────
// MODELS is a Record keyed by short name ("claude", "openai", etc.)
// `id` = short key (used in settings.activeModel, settings.modelKeys, priority arrays)
// `modelId` = actual API model ID sent in the request body

export interface ModelDef {
  id: string;           // Short key: "claude", "openai", etc.
  modelId: string;      // Actual API model ID: "claude-sonnet-4-20250514"
  name: string;
  label: string;
  provider: "anthropic" | "openai" | "google" | "groq" | "mistral";
  endpoint: string;
  maxTokens: number;
  contextWindow: number;
  color: string;
  needsKey: boolean;    // false = works without key (fails gracefully with clear error)
  supportsTools: boolean;
  keyUrl: string;
  apiLabel: string;
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
    needsKey: false,
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
    supportsTools: false,
    keyUrl: "https://platform.openai.com/api-keys",
    apiLabel: "OpenAI API Key",
  },
  gemini: {
    id: "gemini",
    modelId: "gemini-2.0-flash",
    name: "Gemini",
    label: "Gemini 2.0 Flash (Google)",
    provider: "google",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    maxTokens: 4096,
    contextWindow: 1000000,
    color: "from-blue-500 to-blue-700",
    needsKey: true,
    supportsTools: false,
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
    supportsTools: false,
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
    supportsTools: false,
    keyUrl: "https://console.mistral.ai/api-keys/",
    apiLabel: "Mistral API Key",
  },
};

// ─── Safe fetch ───────────────────────────────────────────────────────────────

export const safeFetch = async (url: string, opts: RequestInit): Promise<unknown> => {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
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
  if (def.provider === "google") {
    if (!apiKey) throw new Error("No Google AI API key — add one in Settings → AI Models.");

    const contents = opts.messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: typeof m.content === "string"
          ? [{ text: m.content }]
          : [{ text: String(m.content) }],
      }));

    const url = `${def.endpoint}?key=${apiKey}`;
    const data = await safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
        ...(opts.systemPrompt ? { systemInstruction: { parts: [{ text: opts.systemPrompt }] } } : {}),
      }),
    }) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { text, toolUses: [], stopReason: "end_turn", raw: data };
  }

  // ── OpenAI-compatible (OpenAI, Groq, Mistral) ──────────────────────────────
  if (!apiKey) throw new Error(`No ${def.name} API key — add one in Settings → AI Models.`);

  const openAiMessages = [
    ...(opts.systemPrompt ? [{ role: "system", content: opts.systemPrompt }] : []),
    ...opts.messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role as string,
        content: typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? (m.content as Array<{ type: string; text?: string }>)
                .filter(b => b.type === "text")
                .map(b => b.text ?? "")
                .join("")
            : String(m.content),
      })),
  ];

  const data = await safeFetch(def.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: def.modelId,
      max_tokens: maxTokens,
      messages: openAiMessages,
    }),
  }) as { choices?: Array<{ message?: { content?: string } }> };

  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, toolUses: [], stopReason: "end_turn", raw: data };
};
