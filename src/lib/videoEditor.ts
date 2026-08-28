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
    // BUG FIX — 500 lines was too small a cap even with -nostats added at
    // each call site (detectSilence) — a longer clip's silencedetect
    // output alone can exceed it. 4000 gives real headroom without
    // holding onto an unbounded amount of log text across the app's
    // lifetime.
    ff.on("log", ({ message }: any) => { lastLog.push(message); if (lastLog.length > 4000) lastLog.shift(); });
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

// FEATURE — "you should be able to crop stuff, resize it." x/y/w/h are
// fractions (0-1) of the clip's OWN source pixel dimensions (clip.width/
// clip.height, probed by readVideoMeta below) — resolution-independent so
// the same crop rect means the same thing regardless of the source
// clip's actual resolution. Applied to the source BEFORE rotation/flip
// and before the aspect-ratio reframe.
export type CropRect = { x: number; y: number; w: number; h: number };

export type EditorClip = {
  id: string; file: File; startSec: number; endSec: number; durationSec: number;
  // Source pixel dimensions, probed once when the clip is added (see
  // readVideoMeta) — needed to turn a fractional crop rect into real pixel
  // coordinates for ffmpeg's crop filter.
  width?: number; height?: number;
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
  crop?: CropRect;
  // FEATURE — "change saturation, contrast, brightness, etc." All three on
  // a -100..100 slider scale (0 = unchanged); mapped to ffmpeg's eq filter
  // ranges in renderFinalVideo, and to CSS filter() percentages for the
  // live preview so what's on screen while editing matches the export.
  brightness?: number; contrast?: number; saturation?: number;
  // FEATURE — "more photo editing options." A still image can be added as
  // a clip too (uploaded alongside/instead of video) — rendered as a fixed-
  // duration segment via ffmpeg's `-loop 1` image-to-video path, then flows
  // through the exact same crop/rotate/color/reframe pipeline every video
  // clip already goes through. isImage is set once at add-time from the
  // file's MIME type; durationSec for an image clip is the OWNER-CHOSEN
  // on-screen time (default 3s), not a probed media duration.
  isImage?: boolean;
  // FEATURE — "applying various sound effects such as muffled or
  // underwater sounds." Applied to this clip's own audio only, during
  // normalization — an id from SOUND_EFFECTS above.
  audioEffect?: string;
  // FEATURE — per-clip mute (e.g. wind noise on one clip, but keep the
  // others' audio) — silences via volume=0 rather than dropping the audio
  // stream entirely, since concat/xfade require every segment to share the
  // same stream layout (see the "even if the source clip is silent"
  // comment on the normalization step below).
  muted?: boolean;
};
export type EditorCaption = {
  id: string; text: string; startSec: number; endSec: number; styleId: string;
  // FEATURE — "move the text around." Normalized 0-1 position overriding
  // the style's default top/center/bottom placement when set — null/
  // undefined keeps using the style's own position.
  xPct?: number; yPct?: number;
  // FEATURE — "click a caption to resize it, like in CapCut." Multiplier
  // on the style's base font size (1 = unchanged); applied identically in
  // the live CSS preview and the real ffmpeg drawtext fontsize= expression
  // in renderFinalVideo so what's dragged in the editor is what exports.
  fontScale?: number;
};

// FEATURE — "multi-track editor with overlays... allow users to add their
// own branding — import their logo, phone number... drag and drop those
// assets into the editor." A real second (and third, etc.) visual layer on
// top of the main clip track — an image (logo, phone-number graphic, any
// branding asset) positioned and timed independently of the clips below
// it, rendered via ffmpeg's real `overlay` filter (see renderFinalVideo).
// FEATURE — "picture-in-picture video." An overlay can now be `kind:
// "video"` instead of just a static image — a second clip (own `file`,
// kept in memory only, never pushed through the base64-data-URL brand
// asset path) composited on top of the main timeline with the exact same
// position/size/drag-resize/time-window machinery images already use.
// `muted` defaults to true: mixing the PiP clip's own audio in under the
// main track's is supported (see renderFinalVideo) but most PiP use cases
// (a talking-head cam over B-roll, a logo sting) want it silent by
// default so it doesn't compete with the main clip's audio; the owner can
// un-mute it per-overlay if they actually want both audio tracks.
export type EditorOverlay = {
  id: string; name: string;
  kind?: "image" | "video"; // default "image" — unset means image, for back-compat with saved overlays
  src: string; // image: data URL (brand asset or one-off upload). video: object URL, preview only.
  file?: File; // video overlays only — the real file ffmpeg reads from for export.
  muted?: boolean; // video overlays only.
  // GLOBAL timeline seconds, same convention as EditorCaption.
  startSec: number; endSec: number;
  // Center position (0-1 of frame) and width as a fraction of frame width
  // (height follows the source image's own aspect ratio) — same
  // fraction-of-rendered-box math the caption drag/crop tools already use.
  xPct: number; yPct: number; widthPct: number; opacity: number;
};

// FEATURE — "enable adding music, moving music tracks." A single music
// track (CapCut supports many; one is the real, useful 90% case for a
// short-form business promo video) mixed into the final audio under
// whatever the clips' own audio already is. `startSec` is where in the
// GLOBAL timeline it begins playing — draggable on the music track row in
// the UI, same drag pattern as everything else here.
export type MusicTrack = {
  id: string; file: File; name: string; durationSec: number;
  startSec: number; trimStart: number; trimEnd: number; volume: number; // volume: 0-2, 1 = unchanged
};

// FEATURE — "applying various sound effects such as muffled or underwater
// sounds... a range of sound effects." Real ffmpeg audio filters, applied
// per-clip (see renderFinalVideo) — every filter here is a standard,
// well-supported ffmpeg audio filter (lowpass/highpass/tremolo/aecho), not
// an experimental one, so it behaves the same in ffmpeg.wasm as desktop
// ffmpeg.
export type SoundEffect = { id: string; name: string; description: string; filter: string };
export const SOUND_EFFECTS: SoundEffect[] = [
  { id: "none", name: "None", description: "Original audio, unaffected.", filter: "" },
  { id: "muffled", name: "Muffled", description: "Low, muted, far-away sound — like through a wall.", filter: "lowpass=f=500" },
  { id: "underwater", name: "Underwater", description: "Submerged, wavy, muted tone.", filter: "lowpass=f=350,tremolo=f=4.5:d=0.6" },
  { id: "telephone", name: "Telephone", description: "Thin, band-limited phone-call sound.", filter: "highpass=f=400,lowpass=f=2600,volume=1.6" },
  { id: "megaphone", name: "Megaphone", description: "Loud, distorted bullhorn/PA sound.", filter: "highpass=f=300,lowpass=f=3400,volume=2.2,alimiter=limit=0.8" },
  { id: "cave-echo", name: "Cave Echo", description: "Big, roomy echo — cavernous space.", filter: "aecho=0.8:0.85:900:0.35" },
  { id: "tinny", name: "Tinny Speaker", description: "Small, cheap-speaker sound — no bass at all.", filter: "highpass=f=900" },
];
export const getSoundEffect = (id?: string): SoundEffect => SOUND_EFFECTS.find(s => s.id === id) || SOUND_EFFECTS[0];

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
  // BUG FIX — "auto-cut silence is analyzing, but doesn't show any
  // result." lastLog is a shared, capped 500-line ring buffer (see
  // loadFfmpeg's `ff.on("log", ...)` above) fed by EVERY log line this
  // exec call prints — including ffmpeg's own per-frame `-stats` progress
  // output, which for anything longer than a few seconds of footage blows
  // past 500 lines on its own and evicts the real silence_start/
  // silence_end pairs before this function ever reads them back out.
  // `-nostats` suppresses that per-frame progress spam (silencedetect's
  // own log lines are a separate, always-on log stream and are
  // unaffected), so the ring buffer only ever holds lines this function
  // actually cares about.
  lastLog = [];
  await ff.exec(["-nostats", "-i", inName, "-af", `silencedetect=noise=${noiseDb}dB:d=${minDurationSec}`, "-f", "null", "-"]);
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

// Same idea as readVideoDuration, but also grabs the source's real pixel
// dimensions — needed to turn a fractional crop rect (see CropRect) into
// real pixel coordinates for ffmpeg's crop filter.
export const readVideoMeta = (file: File): Promise<{ duration: number; width: number; height: number }> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration, w = v.videoWidth, h = v.videoHeight;
      URL.revokeObjectURL(url);
      resolve({ duration: Number.isFinite(d) ? d : 0, width: w || 0, height: h || 0 });
    };
    v.onerror = () => { URL.revokeObjectURL(url); resolve({ duration: 0, width: 0, height: 0 }); };
    v.src = url;
  });

// Reads a still image's real pixel dimensions — the image-clip equivalent
// of readVideoMeta, used when a photo is added to the timeline (see
// EditorClip.isImage above).
export const readImageMeta = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { const w = img.naturalWidth, h = img.naturalHeight; URL.revokeObjectURL(url); resolve({ width: w || 0, height: h || 0 }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }); };
    img.src = url;
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
  aspectRatio: AspectRatio = "9:16",
  overlays: EditorOverlay[] = [],
  music: MusicTrack | null = null
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
    const isImage = !!c.isImage;
    const inName = `clip-in-${i}.${isImage ? "img" : "mp4"}`;
    const outName = `clip-norm-${i}.mp4`;
    await ff.writeFile(inName, await fetchFile(c.file));
    const dur = Math.max(0.1, c.endSec - c.startSec);
    // Reframe to fill the target box exactly (scale up to cover, then
    // crop the overflow) rather than a plain scale — a plain scale to a
    // different aspect ratio than the source either distorts or
    // letterboxes; this is the standard "reframe" technique CapCut and
    // every other short-form editor uses. A manual crop (if the owner drew
    // one) comes first — relative to the SOURCE's own pixels, before
    // rotation/flip touch the frame at all — then rotation/flip, then any
    // color adjustment, then the aspect-ratio reframe.
    const filters: string[] = [];
    if (c.crop && c.width && c.height) {
      const cw = Math.max(2, Math.round(c.crop.w * c.width / 2) * 2);
      const ch = Math.max(2, Math.round(c.crop.h * c.height / 2) * 2);
      const cx = Math.max(0, Math.round(c.crop.x * c.width));
      const cy = Math.max(0, Math.round(c.crop.y * c.height));
      filters.push(`crop=${cw}:${ch}:${cx}:${cy}`);
    }
    if (c.rotation === 90) filters.push("transpose=1");
    else if (c.rotation === 180) filters.push("transpose=1,transpose=1");
    else if (c.rotation === 270) filters.push("transpose=2");
    if (c.flipH) filters.push("hflip");
    // FEATURE — "change saturation, contrast, brightness, etc." -100..100
    // sliders mapped onto ffmpeg eq's real ranges: brightness -1..1,
    // contrast 0..2, saturation 0..3 (clamped — the slider only reaches 2).
    const hasColorAdjust = !!(c.brightness || c.contrast || c.saturation);
    if (hasColorAdjust) {
      const b = ((c.brightness || 0) / 100).toFixed(3);
      const cst = (1 + (c.contrast || 0) / 100).toFixed(3);
      const s = Math.max(0, 1 + (c.saturation || 0) / 100).toFixed(3);
      filters.push(`eq=brightness=${b}:contrast=${cst}:saturation=${s}`);
    }
    filters.push(`scale=${targetW}:${targetH}:force_original_aspect_ratio=increase`, `crop=${targetW}:${targetH}`, "fps=30");
    // FEATURE — "applying various sound effects such as muffled or
    // underwater sounds." Applied to this clip's own audio stream during
    // normalization, before concat/xfade ever sees it — the same standard
    // ffmpeg audio filter shown in the editor's live description.
    const fx = getSoundEffect(c.audioEffect);
    const combinedAudioFilter = [fx.filter, c.muted ? "volume=0" : null].filter(Boolean).join(",");
    const audioArgs = combinedAudioFilter ? ["-af", combinedAudioFilter] : [];
    if (isImage) {
      // FEATURE — "more photo editing options." A still image has no
      // native timeline to seek/trim — `-loop 1` turns it into a video
      // stream for exactly `dur` seconds, and a synthetic silent audio
      // track (anullsrc) keeps this clip's stream layout identical to
      // every real video clip's, which concat/xfade both require.
      await ff.exec([
        "-loop", "1", "-i", inName,
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-t", String(dur),
        "-vf", filters.join(","),
        ...audioArgs,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-shortest", "-movflags", "+faststart",
        outName,
      ]);
    } else {
      await ff.exec([
        "-ss", String(c.startSec), "-i", inName, "-t", String(dur),
        // Even dimensions (libx264 requires them — targetW/H above are
        // already even) and a real audio track even if the source clip is
        // silent (concat/xfade both need every segment to have the same
        // stream layout).
        "-vf", filters.join(","),
        ...audioArgs,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart",
        outName,
      ]);
    }
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
      // FEATURE — "click a caption to resize it." fontScale defaults to 1
      // (unchanged) — real pixel size in the actual export, not just a
      // preview-only CSS affectation.
      const fontScale = cap.fontScale && cap.fontScale > 0 ? cap.fontScale : 1;
      drawtextFilters.push(
        `drawtext=fontfile=${fontFile}:text='${text}':fontcolor=${style.color}:fontsize=h*${(0.055 * fontScale).toFixed(4)}` +
        `:x=${baseX}:y=${y}${strokeParts}${boxParts}` +
        `:enable='between(t,${cap.startSec},${cap.endSec})':alpha='${alphaExpr}'`
      );
    }
    await ff.exec(["-i", finalInput, "-vf", drawtextFilters.join(","), "-c:a", "copy", "captioned.mp4"]);
    await ff.deleteFile(finalInput).catch(() => {});
    finalInput = "captioned.mp4";
  }

  // FEATURE — "add a CapCut-style multi-track editor with overlays, drag
  // and drop... their own branding — logo, phone number." Each overlay is
  // scaled to its own widthPct of the frame and composited with ffmpeg's
  // real `overlay` filter, gated to only be visible during its own
  // startSec–endSec window — the exact same time-gating technique already
  // used for captions above, just for an image layer instead of drawtext.
  // Applied one at a time (simpler and more debuggable than one giant
  // filter_complex for an arbitrary number of overlays) — each overlay's
  // output becomes the next overlay's input.
  if (overlays.length > 0) {
    onProgress?.("Compositing overlays", 78);
    for (let i = 0; i < overlays.length; i++) {
      const ov = overlays[i];
      const outName = `overlaid-${i}.mp4`;
      const ovW = Math.max(2, Math.round(ov.widthPct * targetW / 2) * 2);
      const opacity = Math.max(0, Math.min(1, ov.opacity));
      if (ov.kind === "video" && ov.file) {
        // Picture-in-picture: the PiP clip's own frames are trimmed to the
        // overlay's own on-screen duration, then time-shifted (setpts +
        // startSec/TB) so they land at the right point on the GLOBAL
        // timeline before being composited — `overlay=...enable=between(...)`
        // still gates visibility to that exact window the same as an image.
        const pipName = `pip-${i}-` + ov.file.name.replace(/[^a-z0-9.]/gi, "_");
        await ff.writeFile(pipName, await fetchFile(ov.file));
        const dur = Math.max(0.1, ov.endSec - ov.startSec);
        const videoChain =
          `[1:v]scale=${ovW}:-1,trim=duration=${dur},setpts=PTS-STARTPTS+${ov.startSec}/TB[pipv${i}];` +
          (opacity < 1 ? `[pipv${i}]format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}[pipv${i}a];` : "") +
          `[0:v][pipv${i}${opacity < 1 ? "a" : ""}]overlay=x=${ov.xPct.toFixed(4)}*W-w/2:y=${ov.yPct.toFixed(4)}*H-h/2:enable='between(t,${ov.startSec},${ov.endSec})'[vout${i}]`;
        if (ov.muted === false) {
          // Mix the PiP clip's own audio in under the main track's, the same
          // trim/delay/amix technique the music stage below uses — delayed
          // by startSec so it lines up with when the PiP actually appears.
          const delayMs = Math.max(0, Math.round(ov.startSec * 1000));
          const audioChain = `[1:a]atrim=start=0:duration=${dur},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs}[pipa${i}];[0:a][pipa${i}]amix=inputs=2:duration=first:dropout_transition=0[aout${i}]`;
          await ff.exec(["-i", finalInput, "-i", pipName, "-filter_complex", `${videoChain};${audioChain}`, "-map", `[vout${i}]`, "-map", `[aout${i}]`, "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", outName]);
        } else {
          await ff.exec(["-i", finalInput, "-i", pipName, "-filter_complex", videoChain, "-map", `[vout${i}]`, "-map", "0:a", "-c:a", "copy", outName]);
        }
        await ff.deleteFile(pipName).catch(() => {});
      } else {
        const imgName = `overlay-${i}.png`;
        const res = await fetch(ov.src);
        const buf = new Uint8Array(await res.arrayBuffer());
        await ff.writeFile(imgName, buf);
        const overlayFilter =
          `[1:v]scale=${ovW}:-1[ovl${i}];` +
          (opacity < 1 ? `[ovl${i}]format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}[ovl${i}a];` : "") +
          `[0:v][ovl${i}${opacity < 1 ? "a" : ""}]overlay=x=${(ov.xPct).toFixed(4)}*W-w/2:y=${(ov.yPct).toFixed(4)}*H-h/2:enable='between(t,${ov.startSec},${ov.endSec})'`;
        await ff.exec(["-i", finalInput, "-i", imgName, "-filter_complex", overlayFilter, "-c:a", "copy", outName]);
        await ff.deleteFile(imgName).catch(() => {});
      }
      await ff.deleteFile(finalInput).catch(() => {});
      finalInput = outName;
    }
  }

  // FEATURE — "enable adding music, moving music tracks." Trims the music
  // file to its own selected window, applies volume, delays it to start at
  // the right point in the GLOBAL timeline (adelay — ffmpeg's real per-
  // channel audio-offset filter), and mixes it under the video's existing
  // audio with amix (duration=first keeps the output length pinned to the
  // video, so a long music file can never extend the final export).
  if (music) {
    onProgress?.("Mixing music", 88);
    const musicIn = "music-in." + (music.file.name.split(".").pop() || "mp3");
    await ff.writeFile(musicIn, await fetchFile(music.file));
    const trimDur = Math.max(0.1, music.trimEnd - music.trimStart);
    const delayMs = Math.max(0, Math.round(music.startSec * 1000));
    const vol = Math.max(0, music.volume);
    const musicFilter = `[1:a]atrim=start=${music.trimStart}:duration=${trimDur},asetpts=PTS-STARTPTS,volume=${vol.toFixed(3)},adelay=${delayMs}|${delayMs}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=0[aout]`;
    await ff.exec(["-i", finalInput, "-i", musicIn, "-filter_complex", musicFilter, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "mixed.mp4"]);
    await ff.deleteFile(finalInput).catch(() => {});
    await ff.deleteFile(musicIn).catch(() => {});
    finalInput = "mixed.mp4";
  }

  onProgress?.("Finalizing", 92);
  const data = await ff.readFile(finalInput);
  await ff.deleteFile(finalInput).catch(() => {});
  onProgress?.("Done", 100);
  return new Blob([data as any], { type: "video/mp4" });
};
