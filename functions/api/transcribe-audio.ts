// FEATURE — "can it automatically create captions? I feel like you can
// build it." Real speech-to-text isn't something a browser can do offline
// for a pre-recorded file (the Web Speech API only works on a LIVE
// microphone stream, not an audio blob — already used elsewhere in this
// app for voice-to-text checklist notes, which is exactly that live-mic
// case) — genuine transcription needs a real model call. Runs server-side
// only because CORS blocks a direct browser→api multipart/binary upload
// the same way every other direct-API integration in this app already
// routes through a Cloudflare Function.
//
// FEATURE — "make it so it uses any API, not just OpenAI's." Three real,
// independently-selectable providers, not just OpenAI reskinned: OpenAI
// Whisper and Groq's Whisper endpoint are both OpenAI-compatible multipart
// APIs (reuses whichever of those keys the owner already has in Settings →
// AI Models — no new signup needed), while Deepgram is a genuinely
// different API shape entirely (raw audio bytes, not multipart form-data,
// its own response schema) — added so an owner isn't locked into one
// vendor if OpenAI's is down, rate-limited, or they'd rather not use it.
//
// BUG FIX (integration audit 2026-11-13) — the browser sent
// settings.modelKeys.openai/groq, which is only the masked "••••••••"
// placeholder since keys moved to owner_secrets, so every OpenAI/Groq
// caption call failed with a bad-key error (and this endpoint needed no
// sign-in at all). Now requires a signed-in session and loads the real key
// server-side, like alfred-transcribe.ts. Deepgram's key still lives in
// app_settings.data.deepgramApiKey, so it's read from there server-side.
import { getOwnerSecrets, resolveCallerOwnerId } from "./_lib/ownerSecrets";
import { SUPABASE_URL } from "./_lib/env";

const loadServerKey = async (ownerId: string, provider: string, serviceRoleKey: string): Promise<string> => {
  if (provider === "deepgram") {
    const rows = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=data&limit=1`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } })
      .then(r => r.json()).catch(() => []);
    const k = Array.isArray(rows) ? rows[0]?.data?.deepgramApiKey : "";
    return typeof k === "string" && !/^•+$/.test(k.trim()) ? k.trim() : "";
  }
  const secrets = await getOwnerSecrets(ownerId, serviceRoleKey).catch(() => null);
  const k = secrets?.modelKeys?.[provider === "groq" ? "groq" : "openai"];
  return typeof k === "string" ? k.trim() : "";
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const token = (context.request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const ownerId = await resolveCallerOwnerId(token).catch(() => null);
    if (!ownerId) return json({ error: "Sign in again to use auto-captions." }, 401);
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY isn't set on the server" }, 500);
    const incomingForm = await context.request.formData();
    const audioFile = incomingForm.get("audio");
    const provider = String(incomingForm.get("provider") || "openai");
    if (!(audioFile instanceof File)) return json({ error: "Missing audio file" }, 400);
    const apiKey = await loadServerKey(ownerId, provider, serviceRoleKey);
    if (!apiKey) return json({ error: noKeyMessage(provider) }, 400);

    if (provider === "deepgram") {
      const audioBuf = await audioFile.arrayBuffer();
      const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&utterances=true", {
        method: "POST",
        headers: { Authorization: `Token ${apiKey}`, "Content-Type": audioFile.type || "audio/mpeg" },
        body: audioBuf,
      });
      const data = await res.json().catch(() => null) as any;
      if (!res.ok) return json({ error: data?.err_msg || data?.error?.message || `Deepgram transcription failed (HTTP ${res.status})` }, 502);
      const utterances = Array.isArray(data?.results?.utterances) ? data.results.utterances : [];
      const segments = utterances
        .map((u: any) => ({ text: String(u.transcript || "").trim(), start: Number(u.start) || 0, end: Number(u.end) || 0 }))
        .filter((s: any) => s.text);
      const fullText = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
      return json({ segments, fullText });
    }

    // OpenAI + Groq — both OpenAI-compatible multipart Whisper endpoints,
    // differing only in host + model id.
    const endpoint = provider === "groq" ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions";
    const model = provider === "groq" ? "whisper-large-v3-turbo" : "whisper-1";
    const outgoing = new FormData();
    outgoing.append("file", audioFile, "audio.mp3");
    outgoing.append("model", model);
    outgoing.append("response_format", "verbose_json");
    outgoing.append("timestamp_granularities[]", "segment");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: outgoing,
    });
    const data = await res.json().catch(() => null) as any;
    if (!res.ok) return json({ error: data?.error?.message || `Transcription failed (HTTP ${res.status})` }, 502);

    const segments = Array.isArray(data?.segments)
      ? data.segments.map((s: any) => ({ text: String(s.text || "").trim(), start: Number(s.start) || 0, end: Number(s.end) || 0 })).filter((s: any) => s.text)
      : [];
    return json({ segments, fullText: data?.text || "" });
  } catch (e: any) {
    return json({ error: e?.message || "Transcription proxy error" }, 500);
  }
};

const noKeyMessage = (provider: string): string => {
  if (provider === "deepgram") return "No Deepgram API key configured — add one in Settings → Social → Auto-Captions, or use manual captions instead (free, no key needed).";
  if (provider === "groq") return "No Groq API key configured — add one in Settings → AI Models → Groq, or use manual captions instead (free, no key needed).";
  return "No OpenAI API key configured — add one in Settings → AI Models → OpenAI, or use manual captions instead (free, no key needed).";
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
