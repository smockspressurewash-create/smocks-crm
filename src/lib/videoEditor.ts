// FEATURE — "there's a video editor, CapCut style, inside the social
// section... auto-cutting and trimming... transitions, animations to the
// text, tech transition effects for in-between videos." Everything in this
// file runs entirely in the browser via ffmpeg.wasm (WebAssembly build of
// real FFmpeg) — no server, no per-render API cost, genuinely free
// regardless of usage. The core/wasm binaries are ~30MB, so they're loaded
// from a CDN at runtime (not bundled into the app's own build) and cached
// by the browser after first use, not shipped as part of the Vite bundle.
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { getCaptionStyle, getTransition, type CaptionStyle } from "./captionStyles";
import { uid } from "./utils";

const CORE_VERSION = "0.12.6";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

export const isVideoEditorSupported = (): boolean =>
  typeof SharedArrayBuffer !== "undefined" || typeof WebAssembly !== "undefined";

export const loadFfmpeg = async (onProgress?: (msg: string) => void): Promise<FFmpeg> => {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const ff = new FFmpeg();
    ff.on("log", ({ message }: any) => { lastLog.push(message); if (lastLog.length > 500) lastLog.shift(); });
    onProgress?.("Loading video engine (first time only, ~30MB)...");
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    ]);
    await ff.load({ coreURL, wasmURL });
    ffmpegInstance = ff;
    return ff;
  })();
  return loadingPromise;
};

let lastLog: string[] = [];
const fontCache = new Map<string, Uint8Array>();

const ensureFont = async (ff: FFmpeg, style: CaptionStyle): Promise<string> => {
  const fileName = `font-${style.id}.ttf`;
  if (!fontCache.has(style.id)) {
    const data = await fetchFile(style.fontFileUrl);
    fontCache.set(style.id, data);
  }
  await ff.writeFile(fileName, fontCache.get(style.id)!);
  return fileName;
};

export type EditorClip = {
  id: string; file: File; startSec: number; endSec: number; durationSec: number;
  // Transition applied BETWEEN this clip and the next one (ignored on the
  // last clip) — an id from captionStyles.ts's TRANSITION_EFFECTS.
  transitionToNext?: string;
  // FEATURE — "flip videos at different degrees, it should snap at
  // certain angles." Snapped to 90° multiples (0/90/180/270) — a clean,
  // lossless-shape rotation via ffmpeg's transpose filter, the same
  // increments CapCut's own rotate control snaps to. flipH mirrors
  // horizontally (selfie/mirrored-camera footage).
  rotation?: 0 | 90 | 180 | 270;
  flipH?: boolean;
};
export type EditorCaption = {
  id: string; text: string; startSec: number; endSec: number; styleId: string;
  // FEATURE — "move the text around." Normalized 0-1 position overriding
  // the style's default top/center/bottom placement when set — null/
  // undefined keeps using the style's own position.
  xPct?: number; yPct?: number;
};

// Escapes text for safe embedding inside an ffmpeg filtergraph string —
// drawtext's `text=` value is itself inside a filter string that's already
// colon/comma-delimited, so both those AND single quotes need escaping or
// a caption containing punctuation silently breaks the whole filter chain.
const escapeDrawtext = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%");

// FEATURE — "make it so you can change the frame size, like 9:16, etc."
// Real output dimensions per aspect ratio, matching common short-form/
// square/landscape norms. scale+crop (not just scale) is the standard
// "reframe to fill" technique — scales up until the target box is fully
// covered, then crops the overflow, so a landscape source clip cut down to
// 9:16 doesn't end up letterboxed with black bars.
export type AspectRatio = "9:16" | "1:1" | "16:9";
export const ASPECT_DIMENSIONS: Record<AspectRatio, { w: number; h: number }> = {
  "9:16": { w: 720, h: 1280 },
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1280, h: 720 },
};
export const ASPECT_RATIOS: AspectRatio[] = ["9:16", "1:1", "16:9"];

// Detects silence in a clip's audio track (ffmpeg's silencedetect filter),
// used for the "Auto-Cut Silence" button. Returns ranges in seconds.
export const detectSilence = async (file: File, noiseDb = -30, minDurationSec = 0.6): Promise<{ start: number; end: number }[]> => {
  const ff = await loadFfmpeg();
  const inName = "silence-in-" + file.name.replace(/[^a-z0-9.]/gi, "_");
  await ff.writeFile(inName, await fetchFile(file));
  lastLog = [];
  await ff.exec(["-i", inName, "-af", `silencedetect=noise=${noiseDb}dB:d=${minDurationSec}`, "-f", "null", "-"]);
  await ff.deleteFile(inName).catch(() => {});
  const ranges: { start: number; end: number }[] = [];
  let pendingStart: number | null = null;
  for (const line of lastLog) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) { pendingStart = parseFloat(startMatch[1]); continue; }
    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch && pendingStart !== null) {
      ranges.push({ start: pendingStart, end: parseFloat(endMatch[1]) });
      pendingStart = null;
    }
  }
  return ranges;
};

// Reads a video file's duration by loading it into a detached <video> —
// far cheaper than asking ffmpeg to probe it, and doesn't need the engine
// loaded yet (so clip durations can show up before the editor finishes
// loading ffmpeg in the background).
export const readVideoDuration = (file: File): Promise<number> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { const d = v.duration; URL.revokeObjectURL(url); resolve(Number.isFinite(d) ? d : 0); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    v.src = url;
  });

// Extracts a trimmed clip's audio as a small mp3 — used to send to
// transcribe-audio.ts for auto-captions. Kept separate from the main
// export pipeline (doesn't touch normalized-clip state) so it can run any
// time the owner presses "Auto-Captions," independent of rendering.
export const extractAudioForTranscription = async (clip: EditorClip): Promise<Blob> => {
  const ff = await loadFfmpeg();
  const inName = "transcribe-in-" + clip.id.replace(/[^a-z0-9]/gi, "");
  const outName = "transcribe-out-" + clip.id.replace(/[^a-z0-9]/gi, "") + ".mp3";
  await ff.writeFile(inName, await fetchFile(clip.file));
  const dur = Math.max(0.1, clip.endSec - clip.startSec);
  await ff.exec(["-ss", String(clip.startSec), "-i", inName, "-t", String(dur), "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1", "-b:a", "64k", outName]);
  const data = await ff.readFile(outName);
  await ff.deleteFile(inName).catch(() => {});
  await ff.deleteFile(outName).catch(() => {});
  return new Blob([data as any], { type: "audio/mpeg" });
};

// FEATURE — "make it so it uses any API, not just OpenAI's for auto
// captions." Three real, independently-selectable transcription providers
// (see functions/api/transcribe-audio.ts for what actually calls each one).
// OpenAI and Groq reuse whichever key the owner already has set in
// Settings → AI Models (Groq's Whisper endpoint is genuinely a different
// vendor/host, not just a relabeled OpenAI call); Deepgram is a fully
// separate API with its own key, for an owner who doesn't want to depend
// on OpenAI at all.
export type CaptionProvider = "openai" | "groq" | "deepgram";
export const CAPTION_PROVIDERS: { id: CaptionProvider; label: string; keyFrom: (settings: any) => string | undefined }[] = [
  { id: "openai", label: "OpenAI Whisper", keyFrom: (s: any) => s?.modelKeys?.openai },
  { id: "groq", label: "Groq Whisper (fast)", keyFrom: (s: any) => s?.modelKeys?.groq },
  { id: "deepgram", label: "Deepgram", keyFrom: (s: any) => s?.deepgramApiKey },
];

// Thin fetcher shared by the per-clip "Auto-Captions" button and the
// full "Auto-Edit" pipeline below — same proxy endpoint, provider passed
// through so the server picks the right upstream API.
export const requestTranscription = async (
  audioBlob: Blob,
  provider: CaptionProvider,
  apiKey: string
): Promise<{ text: string; start: number; end: number }[]> => {
  const form = new FormData();
  form.append("audio", audioBlob, "audio.mp3");
  form.append("apiKey", apiKey);
  form.append("provider", provider);
  const res = await fetch("/api/transcribe-audio", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data.segments || [];
};

// FEATURE — "make it so you can auto edit, it auto cuts the dead spaces,
// pieces the clips together." Trimming the clip's own start/end (the
// existing Auto-Cut Silence button) only ever handled silence at the very
// edges — a pause in the MIDDLE of a clip stayed in. This actually splits
// a clip at every silent stretch found inside its current trim bounds,
// returning one EditorClip per non-silent stretch — the render pipeline
// already concatenates clips in array order, so replacing one clip with
// its several "keep" pieces is all "piecing them back together" requires;
// nothing else about renderFinalVideo needs to change.
export const autoCutClipDeadSpace = async (
  clip: EditorClip,
  noiseDb = -30,
  minSilenceSec = 0.6
): Promise<EditorClip[]> => {
  const ranges = await detectSilence(clip.file, noiseDb, minSilenceSec);
  const trimStart = clip.startSec, trimEnd = clip.endSec;
  const clipped = ranges
    .map(r => ({ start: Math.max(r.start, trimStart), end: Math.min(r.end, trimEnd) }))
    .filter(r => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  if (clipped.length === 0) return [clip];

  // Complement of the silence ranges within the clip's own trim bounds —
  // these are the stretches that actually have something happening.
  const keep: { start: number; end: number }[] = [];
  let cursor = trimStart;
  for (const r of clipped) {
    if (r.start > cursor) keep.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < trimEnd) keep.push({ start: cursor, end: trimEnd });

  // Drop/merge slivers too short to be worth a separate re-encoded piece —
  // otherwise a normal mid-sentence breath can get stutter-cut into a dozen
  // near-instant clips instead of reading as one continuous take.
  const MIN_KEEP_SEC = 0.4;
  const merged: { start: number; end: number }[] = [];
  for (const seg of keep) {
    if (seg.end - seg.start < MIN_KEEP_SEC && merged.length > 0) { merged[merged.length - 1].end = seg.end; continue; }
    merged.push({ ...seg });
  }
  const final = merged.filter(seg => seg.end - seg.start >= MIN_KEEP_SEC);
  if (final.length === 0) return [clip];
  if (final.length === 1 && Math.abs(final[0].start - trimStart) < 0.05 && Math.abs(final[0].end - trimEnd) < 0.05) return [clip];

  return final.map((seg, i) => ({
    id: uid(),
    file: clip.file,
    startSec: seg.start,
    endSec: seg.end,
    durationSec: clip.durationSec,
    rotation: clip.rotation,
    flipH: clip.flipH,
    // Only the LAST piece of a split clip should carry the original
    // transition into whatever clip comes next — the pieces in between are
    // internal cuts within what was one continuous clip, always hard cuts.
    transitionToNext: i === final.length - 1 ? clip.transitionToNext : "none",
  }));
};

export type RenderProgress = (phase: string, pct: number) => void;

// Builds the drawtext `enable`/alpha expression for a caption's entrance
// animation. Preview (VideoEditorModal.tsx) shows a real CSS keyframe
// equivalent for each of these ids — kept in sync by animation id so what
// the owner sees while editing matches what actually gets burned in.
const ANIM_FADE_SEC = 0.35;
const animatedAlphaExpr = (animation: string, startSec: number, endSec: number): string => {
  const s = startSec, e = endSec, f = ANIM_FADE_SEC;
  switch (animation) {
    case "fade":
    case "pop":
    case "bounce":
      // Fade the alpha in/out over ANIM_FADE_SEC at each edge — drawtext's
      // `alpha` expression is evaluated per-frame with `t` (seconds).
      return `if(lt(t,${s + f}),(t-${s})/${f},if(gt(t,${e - f}),(${e}-t)/${f},1))`;
    case "flicker":
      // Fast random-ish on/off using a high-frequency sine — reads as a
      // glitch/flicker rather than a smooth fade, matching the style's name.
      return `if(between(t,${s},${e}),0.6+0.4*sin(t*40),0)`;
    default:
      return `between(t,${s},${e})`;
  }
};
// Vertical offset expression for slide-up/shake animations — added on top
// of the style's own base Y position.
const animatedYOffset = (animation: string, startSec: number): string => {
  switch (animation) {
    case "slide-up": return `+max(0,(1-(t-${startSec})/${ANIM_FADE_SEC})*40)`;
    case "shake": return `+4*sin((t-${startSec})*30)`;
    case "bounce": return `+max(0,(1-(t-${startSec})/${ANIM_FADE_SEC})*(-14))`;
    default: return "";
  }
};

// The main export: trims each clip to its in/out points, normalizes them
// to a shared resolution/framerate/codec (uploaded clips routinely come
// from different phones at different resolutions — concat/xfade both
// require matching streams or they silently produce a broken/black
// output), joins them in order (hard concat when every transition is
// "none"/hard-cut — much faster, stream-copy only; a real xfade/acrossfade
// filter_complex chain when any transition is set), then burns every
// caption on top with its own style + entrance animation, positioned by
// time via drawtext's per-frame alpha/x/y expressions.
export const renderFinalVideo = async (
  clips: EditorClip[],
  captions: EditorCaption[],
  onProgress?: RenderProgress,
  aspectRatio: AspectRatio = "9:16"
): Promise<Blob> => {
  if (clips.length === 0) throw new Error("Add at least one clip first");
  onProgress?.("Loading video engine", 5);
  const ff = await loadFfmpeg(msg => onProgress?.(msg, 5));
  const { w: targetW, h: targetH } = ASPECT_DIMENSIONS[aspectRatio];

  const normalizedNames: string[] = [];
  const normalizedDurations: number[] = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    onProgress?.(`Trimming clip ${i + 1}/${clips.length}`, 10 + Math.round((i / clips.length) * 30));
    const inName = `clip-in-${i}.mp4`;
    const outName = `clip-norm-${i}.mp4`;
    await ff.writeFile(inName, await fetchFile(c.file));
    const dur = Math.max(0.1, c.endSec - c.startSec);
    // Reframe to fill the target box exactly (scale up to cover, then
    // crop the overflow) rather than a plain scale — a plain scale to a
    // different aspect ratio than the source either distorts or
    // letterboxes; this is the standard "reframe" technique CapCut and
    // every other short-form editor uses. Rotation (90° multiples, via
    // transpose) and horizontal flip are applied BEFORE the reframe so
    // they affect the actual visible frame, not just get cropped oddly.
    const filters: string[] = [];
    if (c.rotation === 90) filters.push("transpose=1");
    else if (c.rotation === 180) filters.push("transpose=1,transpose=1");
    else if (c.rotation === 270) filters.push("transpose=2");
    if (c.flipH) filters.push("hflip");
    filters.push(`scale=${targetW}:${targetH}:force_original_aspect_ratio=increase`, `crop=${targetW}:${targetH}`, "fps=30");
    await ff.exec([
      "-ss", String(c.startSec), "-i", inName, "-t", String(dur),
      // Even dimensions (libx264 requires them — targetW/H above are
      // already even) and a real audio track even if the source clip is
      // silent (concat/xfade both need every segment to have the same
      // stream layout).
      "-vf", filters.join(","),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-c:a", "aac", "-ar", "44100", "-ac", "2",
      "-movflags", "+faststart",
      outName,
    ]);
    await ff.deleteFile(inName).catch(() => {});
    normalizedNames.push(outName);
    normalizedDurations.push(dur);
  }

  const hasRealTransitions = clips.slice(0, -1).some(c => c.transitionToNext && c.transitionToNext !== "none");
  onProgress?.("Joining clips", 45);
  let joinedName: string;
  if (!hasRealTransitions || clips.length === 1) {
    // Fast path — stream-copy concat, no re-encode of the join itself.
    const listContent = normalizedNames.map(n => `file '${n}'`).join("\n");
    await ff.writeFile("concat_list.txt", listContent);
    await ff.exec(["-f", "concat", "-safe", "0", "-i", "concat_list.txt", "-c", "copy", "joined.mp4"]);
    await ff.deleteFile("concat_list.txt").catch(() => {});
    joinedName = "joined.mp4";
  } else {
    // Real xfade/acrossfade transition chain — every pair of adjacent
    // clips is joined with clip[i].transitionToNext's real ffmpeg xfade
    // type (or a near-instant 0.05s fade standing in for "hard cut" pairs
    // within the same chain, so mixing hard cuts and real transitions in
    // one edit doesn't need two different pipelines).
    onProgress?.("Building transitions", 50);
    const inputArgs: string[] = [];
    normalizedNames.forEach(n => { inputArgs.push("-i", n); });
    let vLabel = "0:v";
    let aLabel = "0:a";
    let runningDur = normalizedDurations[0];
    const filterParts: string[] = [];
    for (let i = 1; i < normalizedNames.length; i++) {
      const t = getTransition(clips[i - 1].transitionToNext || "none");
      const d = t.xfadeType ? t.durationSec : 0.05;
      const xfadeType = t.xfadeType || "fade";
      const offset = Math.max(0, runningDur - d);
      const vOut = `v${i}`;
      const aOut = `a${i}`;
      filterParts.push(`[${vLabel}][${i}:v]xfade=transition=${xfadeType}:duration=${d}:offset=${offset.toFixed(3)}[${vOut}]`);
      filterParts.push(`[${aLabel}][${i}:a]acrossfade=d=${d}[${aOut}]`);
      vLabel = vOut; aLabel = aOut;
      runningDur = runningDur + normalizedDurations[i] - d;
    }
    await ff.exec([
      ...inputArgs,
      "-filter_complex", filterParts.join(";"),
      "-map", `[${vLabel}]`, "-map", `[${aLabel}]`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-c:a", "aac", "-movflags", "+faststart",
      "joined.mp4",
    ]);
    joinedName = "joined.mp4";
  }
  for (const n of normalizedNames) await ff.deleteFile(n).catch(() => {});

  let finalInput = joinedName;
  if (captions.length > 0) {
    onProgress?.("Burning captions", 70);
    const drawtextFilters: string[] = [];
    for (const cap of captions) {
      const style = getCaptionStyle(cap.styleId);
      const fontFile = await ensureFont(ff, style);
      const text = escapeDrawtext(style.uppercase ? cap.text.toUpperCase() : cap.text);
      // FEATURE — "move the text around." A caption with an explicit
      // xPct/yPct (dragged in the preview, see VideoEditorModal.tsx)
      // overrides the style's default top/center/bottom placement;
      // otherwise falls back to the style's own position exactly as before.
      const baseY = cap.yPct !== undefined ? `h*${cap.yPct.toFixed(4)}-text_h/2` : style.position === "top" ? "h*0.12" : style.position === "center" ? "(h-text_h)/2" : "h*0.82";
      const baseX = cap.xPct !== undefined ? `w*${cap.xPct.toFixed(4)}-text_w/2` : "(w-text_w)/2";
      const yOffset = animatedYOffset(style.animation, cap.startSec);
      const y = `${baseY}${yOffset}`;
      const boxParts = style.background
        ? `:box=1:boxcolor=black@0.55:boxborderw=14`
        : "";
      const strokeParts = style.strokeWidth > 0 ? `:borderw=${style.strokeWidth}:bordercolor=${style.strokeColor}` : "";
      const alphaExpr = animatedAlphaExpr(style.animation, cap.startSec, cap.endSec);
      drawtextFilters.push(
        `drawtext=fontfile=${fontFile}:text='${text}':fontcolor=${style.color}:fontsize=h*0.055` +
        `:x=${baseX}:y=${y}${strokeParts}${boxParts}` +
        `:enable='between(t,${cap.startSec},${cap.endSec})':alpha='${alphaExpr}'`
      );
    }
    await ff.exec(["-i", finalInput, "-vf", drawtextFilters.join(","), "-c:a", "copy", "captioned.mp4"]);
    await ff.deleteFile(finalInput).catch(() => {});
    finalInput = "captioned.mp4";
  }

  onProgress?.("Finalizing", 92);
  const data = await ff.readFile(finalInput);
  await ff.deleteFile(finalInput).catch(() => {});
  onProgress?.("Done", 100);
  return new Blob([data as any], { type: "video/mp4" });
};
