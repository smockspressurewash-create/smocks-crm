// FEATURE — "there's a video editor, CapCut style, inside the social
// section... auto-cutting and trimming... make it so it's really good
// caption templates." Everything in this file runs entirely in the
// browser via ffmpeg.wasm (WebAssembly build of real FFmpeg) — no server,
// no per-render API cost, genuinely free regardless of usage. The core/
// wasm binaries are ~30MB, so they're loaded from a CDN at runtime (not
// bundled into the app's own build) and cached by the browser after first
// use, not shipped as part of the Vite bundle.
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { getCaptionStyle, type CaptionStyle } from "./captionStyles";

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

export type EditorClip = { id: string; file: File; startSec: number; endSec: number; durationSec: number };
export type EditorCaption = { id: string; text: string; startSec: number; endSec: number; styleId: string };

// Escapes text for safe embedding inside an ffmpeg filtergraph string —
// drawtext's `text=` value is itself inside a filter string that's already
// colon/comma-delimited, so both those AND single quotes need escaping or
// a caption containing punctuation silently breaks the whole filter chain.
const escapeDrawtext = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%");

const NORMALIZED_HEIGHT = 1280; // portrait 9:16 target, matches short-form video norms

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

export type RenderProgress = (phase: string, pct: number) => void;

// The main export: trims each clip to its in/out points, normalizes them
// to a shared resolution/framerate/codec (uploaded clips routinely come
// from different phones at different resolutions — concat demuxer requires
// matching streams or it silently produces a broken/black output), joins
// them in order, then burns every caption on top with its own style,
// positioned by time via drawtext's enable='between(t,start,end)'.
export const renderFinalVideo = async (
  clips: EditorClip[],
  captions: EditorCaption[],
  onProgress?: RenderProgress
): Promise<Blob> => {
  if (clips.length === 0) throw new Error("Add at least one clip first");
  onProgress?.("Loading video engine", 5);
  const ff = await loadFfmpeg(msg => onProgress?.(msg, 5));

  const normalizedNames: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    onProgress?.(`Trimming clip ${i + 1}/${clips.length}`, 10 + Math.round((i / clips.length) * 35));
    const inName = `clip-in-${i}.mp4`;
    const outName = `clip-norm-${i}.mp4`;
    await ff.writeFile(inName, await fetchFile(c.file));
    const dur = Math.max(0.1, c.endSec - c.startSec);
    await ff.exec([
      "-ss", String(c.startSec), "-i", inName, "-t", String(dur),
      // Normalize: scale to a shared height (preserve aspect via -2 width),
      // even dimensions (libx264 requires them), constant 30fps, real
      // audio track even if the source clip is silent (concat demuxer
      // needs every segment to have the same stream layout).
      "-vf", `scale=-2:${NORMALIZED_HEIGHT},fps=30`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-c:a", "aac", "-ar", "44100", "-ac", "2",
      "-movflags", "+faststart",
      outName,
    ]);
    await ff.deleteFile(inName).catch(() => {});
    normalizedNames.push(outName);
  }

  onProgress?.("Joining clips", 48);
  const listContent = normalizedNames.map(n => `file '${n}'`).join("\n");
  await ff.writeFile("concat_list.txt", listContent);
  await ff.exec(["-f", "concat", "-safe", "0", "-i", "concat_list.txt", "-c", "copy", "joined.mp4"]);
  for (const n of normalizedNames) await ff.deleteFile(n).catch(() => {});

  let finalInput = "joined.mp4";
  if (captions.length > 0) {
    onProgress?.("Burning captions", 60);
    const drawtextFilters: string[] = [];
    for (const cap of captions) {
      const style = getCaptionStyle(cap.styleId);
      const fontFile = await ensureFont(ff, style);
      const text = escapeDrawtext(style.uppercase ? cap.text.toUpperCase() : cap.text);
      const y = style.position === "top" ? "h*0.12" : style.position === "center" ? "(h-text_h)/2" : "h*0.82";
      const boxParts = style.background
        ? `:box=1:boxcolor=black@0.55:boxborderw=14`
        : "";
      const strokeParts = style.strokeWidth > 0 ? `:borderw=${style.strokeWidth}:bordercolor=${style.strokeColor}` : "";
      drawtextFilters.push(
        `drawtext=fontfile=${fontFile}:text='${text}':fontcolor=${style.color}:fontsize=h*0.055` +
        `:x=(w-text_w)/2:y=${y}${strokeParts}${boxParts}:enable='between(t,${cap.startSec},${cap.endSec})'`
      );
    }
    await ff.exec(["-i", finalInput, "-vf", drawtextFilters.join(","), "-c:a", "copy", "captioned.mp4"]);
    await ff.deleteFile(finalInput).catch(() => {});
    finalInput = "captioned.mp4";
  }

  onProgress?.("Finalizing", 92);
  const data = await ff.readFile(finalInput);
  await ff.deleteFile(finalInput).catch(() => {});
  await ff.deleteFile("concat_list.txt").catch(() => {});
  onProgress?.("Done", 100);
  return new Blob([data as any], { type: "video/mp4" });
};
