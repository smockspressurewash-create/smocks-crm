// ─── Model definitions ─────────────────────────────────────────────────────────
// MODELS is a Record keyed by short name ("claude", "openai", etc.)
// `id` = short key (used in settings.activeModel, settings.modelKeys, priority arrays)
// `modelId` = actual API model ID sent in the request body

export interface ModelDef {
  id: string;           // Short key: "claude", "openai", etc.
  modelId: string;      // Actual API model ID: "claude-sonnet-4-20250514"
  name: string;
  label: string;
  provider: "anthropic" | "openai" | "google" | "groq" | "mistral" | "nvidia";
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
  nvidia_kimi: {
    id: "nvidia_kimi",
    modelId: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    label: "Kimi K2.6 (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 16384,
    contextWindow: 1000000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/moonshotai/kimi-k2.6",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  nvidia_nemotron: {
    id: "nvidia_nemotron",
    modelId: "nvidia/llama-3.1-nemotron-70b-instruct",
    name: "Nemotron 70B",
    label: "Llama 3.1 Nemotron 70B (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 128000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/nvidia/llama-3_1-nemotron-70b-instruct",
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
        generationConfig: { maxOutputTokens: maxTokens },
        ...(opts.systemPrompt ? { systemInstruction: { parts: [{ text: opts.systemPrompt }] } } : {}),
      }),
    }) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }> } }> };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter(p => p.text).map(p => p.text).join("");
    const toolUses = parts
      .filter(p => p.functionCall)
      .map(p => ({ id: p.functionCall!.name, name: p.functionCall!.name, input: p.functionCall!.args ?? {} }));
    const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
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
      ...(openAiTools ? { tools: openAiTools } : {}),
    }),
  }) as { choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; function?: { name: string; arguments?: string } }> } }> };

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
