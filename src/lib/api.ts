// @ts-nocheck
// ─── Models ───────────────────────────────────────────────────────────────────

export interface ModelDef {
  id: string;
  label: string;
  provider: "anthropic" | "openai" | "google" | "groq" | "mistral" | "minimax";
  endpoint: string;
  maxTokens: number;
  contextWindow: number;
}

export const MODELS: ModelDef[] = [
  {
    id: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4 (Recommended)",
    provider: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    maxTokens: 4096,
    contextWindow: 200000,
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5 (Fast)",
    provider: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    maxTokens: 2048,
    contextWindow: 200000,
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 128000,
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "google",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    maxTokens: 4096,
    contextWindow: 1000000,
  },
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B (Groq)",
    provider: "groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 128000,
  },
  {
    id: "mistral-large-latest",
    label: "Mistral Large",
    provider: "mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 128000,
  },
];

// ─── Safe fetch ───────────────────────────────────────────────────────────────

export const safeFetch = async (url: string, opts: RequestInit): Promise<unknown> => {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
};

// ─── Rate limit error parser ──────────────────────────────────────────────────

export const parseRateLimitError = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
    return "Rate limit hit — wait a moment and try again.";
  }
  if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
    return "Invalid API key — check Settings.";
  }
  if (msg.includes("403")) {
    return "API access denied — check your key permissions.";
  }
  return msg;
};

// ─── Unified model caller ─────────────────────────────────────────────────────

export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: "text" | "image";
  text?: string;
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export interface CallModelOptions {
  model: string;
  apiKey: string;
  messages: Message[];
  system?: string;
  maxTokens?: number;
  tools?: unknown[];
}

export const callModel = async (opts: CallModelOptions): Promise<string> => {
  const modelDef = MODELS.find(m => m.id === opts.model) ?? MODELS[0];
  const maxTokens = opts.maxTokens ?? modelDef.maxTokens;

  if (modelDef.provider === "anthropic") {
    const body: Record<string, unknown> = {
      model: opts.model,
      max_tokens: maxTokens,
      messages: opts.messages,
    };
    if (opts.system) body.system = opts.system;
    if (opts.tools?.length) body.tools = opts.tools;

    const data = await safeFetch(modelDef.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    }) as { content: Array<{ type: string; text?: string }> };

    return data.content?.find(b => b.type === "text")?.text ?? "";
  }

  if (modelDef.provider === "google") {
    const contents = opts.messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: typeof m.content === "string"
        ? [{ text: m.content }]
        : (m.content as ContentBlock[]).map(b =>
            b.type === "text" ? { text: b.text } : { inlineData: { mimeType: b.source?.media_type, data: b.source?.data } }
          ),
    }));
    const url = `${modelDef.endpoint}?key=${opts.apiKey}`;
    const data = await safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
        ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      }),
    }) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  // OpenAI-compatible (OpenAI, Groq, Mistral)
  const openAiMessages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    ...opts.messages.map(m => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : (m.content as ContentBlock[]).map(b => b.text ?? "").join(""),
    })),
  ];

  const data = await safeFetch(modelDef.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: maxTokens,
      messages: openAiMessages,
    }),
  }) as { choices?: Array<{ message?: { content?: string } }> };

  return data.choices?.[0]?.message?.content ?? "";
};
