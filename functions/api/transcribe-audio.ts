// FEATURE — "can it automatically create captions? I feel like you can
// build it." Real speech-to-text isn't something a browser can do offline
// for a pre-recorded file (the Web Speech API only works on a LIVE
// microphone stream, not an audio blob — already used elsewhere in this
// app for voice-to-text checklist notes, which is exactly that live-mic
// case) — genuine transcription needs a real model call. Proxies to
// OpenAI's Whisper endpoint using the SAME key the owner may have already
// set up for Alfred (Settings → AI Models → OpenAI) — no separate signup
// needed if they're already using OpenAI for anything else. Runs
// server-side only because CORS blocks a direct browser→api.openai.com
// multipart upload the same way every other direct-API integration in
// this app already routes through a Cloudflare Function.
export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const incomingForm = await context.request.formData();
    const audioFile = incomingForm.get("audio");
    const apiKey = incomingForm.get("apiKey");
    if (!(audioFile instanceof File)) return json({ error: "Missing audio file" }, 400);
    if (!apiKey || typeof apiKey !== "string") return json({ error: "No OpenAI API key configured — add one in Settings → AI Models → OpenAI, or use manual captions instead (free, no key needed)." }, 400);

    const outgoing = new FormData();
    outgoing.append("file", audioFile, "audio.mp3");
    outgoing.append("model", "whisper-1");
    outgoing.append("response_format", "verbose_json");
    outgoing.append("timestamp_granularities[]", "segment");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
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

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
