// alfred-transcribe.ts — turns a voice note recorded in the Alfred chat into
// text. Tries Cloudflare Workers AI Whisper first (free, the same "AI"
// binding text-Alfred uses for voice memos), then the owner's own OpenAI or
// Groq key from owner_secrets. Works for any recording format the browser
// makes (webm on Chrome/Android, mp4/aac on iPhone).
//
// BUG FIX — "I record, press stop, and it does nothing." The chat's voice
// note relied on an OpenAI key typed into the browser or on the browser's
// own speech recognition running alongside the recorder; on an iPhone the
// second fights the first for the microphone, so there was never a
// transcript to send.
// POST multipart: audio=<file>; owner's Supabase access token as Bearer.
import { getOwnerSecrets, resolveCallerOwnerId } from "./_lib/ownerSecrets";

const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, any> }) => {
  try {
    const token = (context.request.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const ownerId = await resolveCallerOwnerId(token).catch(() => null);
    if (!ownerId) return json({ error: "Sign in again to send voice notes." }, 401);
    const form = await context.request.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) return json({ error: "No audio received." }, 400);
    if (file.size < 800) return json({ error: "That recording was empty — check the microphone permission and try again." }, 400);
    if (file.size > 24 * 1024 * 1024) return json({ error: "That recording is too long — keep voice notes under about 10 minutes." }, 400);
    const buf = await file.arrayBuffer();
    const errors: string[] = [];

    const ai = context.env.AI;
    if (ai) {
      try {
        const r: any = await ai.run("@cf/openai/whisper", { audio: Array.from(new Uint8Array(buf)) });
        const text = String(r?.text || "").trim();
        if (text) return json({ text, via: "Cloudflare Whisper" });
        errors.push("Cloudflare Whisper heard nothing");
      } catch (e: any) { errors.push("Cloudflare Whisper: " + (e?.message || "failed")); }
    } else errors.push("Cloudflare AI binding not set up");

    const secrets = context.env.SUPABASE_SERVICE_ROLE_KEY ? await getOwnerSecrets(ownerId, context.env.SUPABASE_SERVICE_ROLE_KEY).catch(() => null) : null;
    const keys = secrets?.modelKeys || {};
    const ext = (file.type.split("/")[1] || "webm").split(";")[0].replace("x-m4a", "m4a").replace("mpeg", "mp3");
    const tries: [string, string, string, string][] = [];
    if (keys.openai) tries.push(["OpenAI Whisper", "https://api.openai.com/v1/audio/transcriptions", "whisper-1", keys.openai]);
    if (keys.groq) tries.push(["Groq Whisper", "https://api.groq.com/openai/v1/audio/transcriptions", "whisper-large-v3-turbo", keys.groq]);
    for (const [name, url, model, key] of tries) {
      try {
        const fd = new FormData();
        fd.append("file", new Blob([buf], { type: file.type || "audio/webm" }), `voice.${ext}`);
        fd.append("model", model);
        const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd });
        const data: any = await res.json().catch(() => null);
        if (res.ok && String(data?.text || "").trim()) return json({ text: String(data.text).trim(), via: name });
        errors.push(`${name}: ${data?.error?.message || "HTTP " + res.status}`);
      } catch (e: any) { errors.push(`${name}: ${e?.message || "failed"}`); }
    }
    return json({ error: "Couldn't turn that into text. " + (tries.length || ai ? errors.join("; ") : "Add the Cloudflare \"AI\" binding (free) or an OpenAI/Groq key in Settings → AI Models."), details: errors }, 502);
  } catch (e: any) {
    return json({ error: e?.message || "Transcription failed" }, 500);
  }
};
