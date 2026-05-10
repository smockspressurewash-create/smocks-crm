// ===== AI MODEL CATALOG & API LAYER =====

export const MODELS: Record<string, any> = {
  claude: { id: "claude", name: "Claude", label: "Claude Sonnet 4", provider: "Anthropic", color: "from-orange-500 to-red-600", accent: "text-orange-400", supportsTools: true, needsKey: false, keyUrl: null, apiLabel: "Built-in", resetWindow: null },
  openai: { id: "openai", name: "ChatGPT", label: "GPT-4o mini", provider: "OpenAI", color: "from-green-500 to-emerald-700", accent: "text-green-400", supportsTools: true, needsKey: true, keyUrl: "https://platform.openai.com/api-keys", apiLabel: "OpenAI API", resetWindow: 60 * 60 * 1000 },
  gemini: { id: "gemini", name: "Gemini", label: "Gemini 2.0 Flash", provider: "Google", color: "from-blue-500 to-indigo-600", accent: "text-blue-400", supportsTools: true, needsKey: true, keyUrl: "https://aistudio.google.com/apikey", apiLabel: "Google AI Studio", resetWindow: 24 * 60 * 60 * 1000 },
  groq: { id: "groq", name: "Groq", label: "Llama 3.1 70B", provider: "Groq", color: "from-orange-400 to-amber-600", accent: "text-amber-400", supportsTools: true, needsKey: true, keyUrl: "https://console.groq.com/keys", apiLabel: "Groq Cloud", resetWindow: 24 * 60 * 60 * 1000 },
  mistral: { id: "mistral", name: "Mistral", label: "Mistral Large", provider: "Mistral AI", color: "from-rose-500 to-pink-700", accent: "text-rose-400", supportsTools: true, needsKey: true, keyUrl: "https://console.mistral.ai/api-keys", apiLabel: "Mistral La Plateforme", resetWindow: 60 * 60 * 1000 },
  minimax: { id: "minimax", name: "MiniMax", label: "MiniMax abab6.5s", provider: "MiniMax", color: "from-cyan-500 to-teal-700", accent: "text-cyan-400", supportsTools: false, needsKey: true, keyUrl: "https://www.minimaxi.com/platform_overview", apiLabel: "MiniMax Platform", resetWindow: 60 * 60 * 1000 }
};

// Safe fetch wrapper — converts CORS/network errors to identifiable messages
export const safeFetch = async (url: string, opts?: any) => {
  try {
    return await fetch(url, opts);
  } catch (err) {
    const e: any = new Error("Failed to fetch — provider blocks browser requests (CORS). Use a backend proxy or pick a model that supports browser calls (Claude works without one).");
    e.isNetwork = true;
    throw e;
  }
};

// Unified AI call — returns { text, toolUses, raw, stopReason, providerModel }
export const callModel = async ({ modelId, apiKey, systemPrompt, messages, tools, maxTokens = 1500 }: any) => {
  if (modelId === "claude") {
    const res = await safeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system: systemPrompt, tools: tools || undefined, messages })
    });
    if (!res.ok) { const err = await res.text().catch(() => ""); const e: any = new Error("HTTP " + res.status + (err ? ": " + err.slice(0, 160) : "")); e.status = res.status; throw e; }
    const data = await res.json();
    const content = data?.content || [];
    const text = content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
    const toolUses = content.filter((c: any) => c.type === "tool_use");
    return { text, toolUses, raw: content, stopReason: data?.stop_reason, providerModel: "claude-sonnet-4" };
  }

  if (modelId === "openai") {
    const oaMessages: any[] = [];
    if (systemPrompt) oaMessages.push({ role: "system", content: systemPrompt });
    for (const m of messages) {
      if (typeof m.content === "string") { oaMessages.push({ role: m.role, content: m.content }); }
      else {
        const textParts = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
        const toolCalls = m.content.filter((c: any) => c.type === "tool_use").map((c: any) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input || {}) } }));
        if (m.role === "assistant") { oaMessages.push({ role: "assistant", content: textParts || null, tool_calls: toolCalls.length ? toolCalls : undefined }); }
        else { m.content.forEach((c: any) => { if (c.type === "tool_result") oaMessages.push({ role: "tool", tool_call_id: c.tool_use_id, content: typeof c.content === "string" ? c.content : JSON.stringify(c.content) }); else if (c.type === "text") oaMessages.push({ role: "user", content: c.text }); }); }
      }
    }
    const oaTools = tools ? tools.map((t: any) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })) : undefined;
    const res = await safeFetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey }, body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: maxTokens, messages: oaMessages, tools: oaTools }) });
    if (!res.ok) { const err = await res.text().catch(() => ""); const e: any = new Error("HTTP " + res.status + (err ? ": " + err.slice(0, 160) : "")); e.status = res.status; throw e; }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message || {};
    const text = msg.content || "";
    const toolUses = (msg.tool_calls || []).map((tc: any) => ({ type: "tool_use", id: tc.id, name: tc.function?.name, input: (() => { try { return JSON.parse(tc.function?.arguments || "{}"); } catch { return {}; } })() }));
    const rawBlocks: any[] = []; if (text) rawBlocks.push({ type: "text", text }); toolUses.forEach((tu: any) => rawBlocks.push(tu));
    return { text, toolUses, raw: rawBlocks, stopReason: toolUses.length ? "tool_use" : "stop", providerModel: "gpt-4o-mini" };
  }

  if (modelId === "gemini") {
    const contents: any[] = [];
    messages.forEach((m: any) => {
      const parts: any[] = [];
      if (typeof m.content === "string") { parts.push({ text: m.content }); }
      else { m.content.forEach((c: any) => { if (c.type === "text") parts.push({ text: c.text }); else if (c.type === "tool_use") parts.push({ functionCall: { name: c.name, args: c.input || {} } }); else if (c.type === "tool_result") parts.push({ functionResponse: { name: c.name || "tool", response: { result: typeof c.content === "string" ? c.content : JSON.stringify(c.content) } } }); }); }
      contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
    });
    const geminiTools = tools ? [{ functionDeclarations: tools.map((t: any) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }] : undefined;
    const res = await safeFetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + encodeURIComponent(apiKey), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined, contents, tools: geminiTools, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 } }) });
    if (!res.ok) { const err = await res.text().catch(() => ""); const e: any = new Error("HTTP " + res.status + (err ? ": " + err.slice(0, 160) : "")); e.status = res.status; throw e; }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.filter((p: any) => p.text).map((p: any) => p.text).join("\n").trim();
    const toolUses = parts.filter((p: any) => p.functionCall).map((p: any) => ({ type: "tool_use", id: "gemini-" + Math.random().toString(36).slice(2, 10), name: p.functionCall.name, input: p.functionCall.args || {} }));
    const rawBlocks: any[] = []; if (text) rawBlocks.push({ type: "text", text }); toolUses.forEach((tu: any) => rawBlocks.push(tu));
    return { text, toolUses, raw: rawBlocks, stopReason: toolUses.length ? "tool_use" : "stop", providerModel: "gemini-2.0-flash" };
  }

  if (modelId === "groq" || modelId === "mistral") {
    const oaMessages: any[] = [];
    if (systemPrompt) oaMessages.push({ role: "system", content: systemPrompt });
    for (const m of messages) {
      if (typeof m.content === "string") { oaMessages.push({ role: m.role, content: m.content }); }
      else {
        const textParts = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
        const toolCalls = m.content.filter((c: any) => c.type === "tool_use").map((c: any) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input || {}) } }));
        if (m.role === "assistant") { oaMessages.push({ role: "assistant", content: textParts || null, tool_calls: toolCalls.length ? toolCalls : undefined }); }
        else { m.content.forEach((c: any) => { if (c.type === "tool_result") oaMessages.push({ role: "tool", tool_call_id: c.tool_use_id, ...(modelId === "mistral" ? { name: c.name || "tool" } : {}), content: typeof c.content === "string" ? c.content : JSON.stringify(c.content) }); else if (c.type === "text") oaMessages.push({ role: "user", content: c.text }); }); }
      }
    }
    const oaTools = tools ? tools.map((t: any) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })) : undefined;
    const url = modelId === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.mistral.ai/v1/chat/completions";
    const model = modelId === "groq" ? "llama-3.3-70b-versatile" : "mistral-large-latest";
    const providerModel = modelId === "groq" ? "llama-3.3-70b" : "mistral-large";
    const res = await safeFetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey }, body: JSON.stringify({ model, max_tokens: maxTokens, messages: oaMessages, tools: oaTools }) });
    if (!res.ok) { const err = await res.text().catch(() => ""); const e: any = new Error("HTTP " + res.status + (err ? ": " + err.slice(0, 160) : "")); e.status = res.status; throw e; }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message || {};
    const text = msg.content || "";
    const toolUses = (msg.tool_calls || []).map((tc: any) => ({ type: "tool_use", id: tc.id, name: tc.function?.name, input: (() => { try { return JSON.parse(tc.function?.arguments || "{}"); } catch { return {}; } })() }));
    const rawBlocks: any[] = []; if (text) rawBlocks.push({ type: "text", text }); toolUses.forEach((tu: any) => rawBlocks.push(tu));
    return { text, toolUses, raw: rawBlocks, stopReason: toolUses.length ? "tool_use" : "stop", providerModel };
  }

  if (modelId === "minimax") {
    const mmMessages: any[] = [];
    if (systemPrompt) mmMessages.push({ sender_type: "BOT", sender_name: "MM Assistant", text: systemPrompt });
    for (const m of messages) {
      const txt = typeof m.content === "string" ? m.content : m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      if (!txt) continue;
      mmMessages.push({ sender_type: m.role === "assistant" ? "BOT" : "USER", sender_name: m.role === "assistant" ? "MM Assistant" : "User", text: txt });
    }
    const res = await safeFetch("https://api.minimaxi.com/v1/text/chatcompletion_v2", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey }, body: JSON.stringify({ model: "abab6.5s-chat", tokens_to_generate: maxTokens, messages: mmMessages.map(m => ({ role: m.sender_type === "BOT" ? "assistant" : "user", content: m.text })) }) });
    if (!res.ok) { const err = await res.text().catch(() => ""); const e: any = new Error("HTTP " + res.status + (err ? ": " + err.slice(0, 160) : "")); e.status = res.status; throw e; }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || data?.reply || "";
    return { text, toolUses: [], raw: [{ type: "text", text }], stopReason: "stop", providerModel: "abab6.5s" };
  }

  throw new Error("Unknown model: " + modelId);
};

export const parseRateLimitError = (err: any, modelId: string) => {
  const msg = (err?.message || "").toLowerCase();
  const status = err?.status;
  const isNetworkError = msg.includes("failed to fetch") || msg.includes("network") || msg.includes("cors") || msg.includes("typeerror");
  if (isNetworkError) return { lockedUntil: Date.now() + 5 * 60 * 1000, reason: "Network/CORS blocked", network: true };
  const isSandboxThrottle = msg.includes("message rate limit exceeded") || msg.includes("reload to continue");
  if (isSandboxThrottle) return { lockedUntil: Date.now() + 3 * 60 * 1000, reason: "Artifact throttle (3 min)", sandbox: true };
  const isRateLimit = status === 429 || msg.includes("rate limit") || msg.includes("quota") || msg.includes("exceeded") || msg.includes("too many") || msg.includes("rate_limit");
  if (!isRateLimit) return null;
  const retryMatch = msg.match(/retry(?:-| )after[: ]+(\d+)/) || msg.match(/in (\d+) seconds/);
  const retrySec = retryMatch ? parseInt(retryMatch[1]) : null;
  const defaultWindow = MODELS[modelId]?.resetWindow || 3600000;
  const lockedUntil = Date.now() + (retrySec ? retrySec * 1000 : defaultWindow);
  return { lockedUntil, reason: "Rate limit" };
};
