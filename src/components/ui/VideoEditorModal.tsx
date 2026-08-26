// FEATURE — CapCut-style video editor inside the Social section: upload
// clips, trim/reorder them, auto-detect+strip silence, add styled
// captions with a live preview, and export a real rendered MP4 — all via
// ffmpeg.wasm in the browser (src/lib/videoEditor.ts), genuinely free with
// no per-render cost. An optional "Auto-Edit with AI" button appears only
// when the owner has configured their own video-API key in Settings (see
// functions/api/video-autoedit.ts) — kept fully separate from the free
// path so nothing here silently starts costing money without the owner
// explicitly opting in with their own account.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { Plus, Trash2, ChevronUp, ChevronDown, Wand2, Scissors, Type, Upload, Sparkles, RotateCw, FlipHorizontal, Captions, Save, Clapperboard } from "lucide-react";
import { uid, uploadJobMedia } from "../../lib/utils";
import { CAPTION_STYLES, CAPTION_GOOGLE_FONTS_HREF, captionStyleToCss, getCaptionStyle, TRANSITION_EFFECTS } from "../../lib/captionStyles";
import { readVideoDuration, detectSilence, renderFinalVideo, extractAudioForTranscription, autoCutClipDeadSpace, requestTranscription, CAPTION_PROVIDERS, ASPECT_RATIOS, type AspectRatio, type CaptionProvider, type EditorClip, type EditorCaption } from "../../lib/videoEditor";

export function VideoEditorModal({ open, onClose, onExported, toast, settings }: {
  open: boolean;
  onClose: () => void;
  // Hands back the finished video as a Blob + a suggested filename — the
  // caller (SocialPage.tsx) owns uploading it to Storage and wiring it
  // into the post form, same as any other media attach path there.
  // draftOnly — "save without posting" (see saveAsDraftOnly below): the
  // caller should just stash the rendered video, not open the post composer.
  onExported: (blob: Blob, draftOnly?: boolean) => void;
  toast?: (msg: string, tone?: any) => void;
  settings?: any;
}) {
  const [clips, setClips] = useState<EditorClip[]>([]);
  const [captions, setCaptions] = useState<EditorCaption[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderPhase, setRenderPhase] = useState("");
  const [renderPct, setRenderPct] = useState(0);
  const [detectingSilence, setDetectingSilence] = useState(false);
  const [silenceRanges, setSilenceRanges] = useState<{ clipId: string; start: number; end: number }[]>([]);
  const [autoEditing, setAutoEditing] = useState(false);
  // FEATURE — "change the frame size, like 9:16, etc."
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  // FEATURE — "can it automatically create captions?" / "use any API, not
  // just OpenAI's." Defaults to whichever provider the owner already has a
  // key for (OpenAI, then Groq, then Deepgram), but is fully switchable.
  const [transcribing, setTranscribing] = useState(false);
  const [captionProvider, setCaptionProvider] = useState<CaptionProvider>("openai");
  useEffect(() => {
    if (!open) return;
    const withKey = CAPTION_PROVIDERS.find(p => !!p.keyFrom(settings));
    if (withKey) setCaptionProvider(withKey.id);
  }, [open]);
  const getCaptionApiKey = (provider: CaptionProvider): string | undefined => CAPTION_PROVIDERS.find(p => p.id === provider)?.keyFrom(settings);
  // FEATURE — "make it so you can auto edit... choose caption templates,
  // review it, can manually edit it, save, etc." Style applied to every
  // caption the Auto-Edit pipeline generates — picked once up front.
  const [autoEditCaptionStyle, setAutoEditCaptionStyle] = useState(CAPTION_STYLES[0].id);
  const [autoEditRunning, setAutoEditRunning] = useState(false);
  const [autoEditPhase, setAutoEditPhase] = useState("");
  // FEATURE — "move the text around." Which caption (if any) is currently
  // being repositioned by tapping/clicking the preview.
  const [positioningCaptionId, setPositioningCaptionId] = useState<string | null>(null);
  // FEATURE — "make it so you can edit videos, but save them and not post
  // them." Whether the export button should hand the result to the post
  // composer (default) or just save it aside as a draft.
  const [saveAsDraftOnly, setSaveAsDraftOnly] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);

  const activeClip = clips.find(c => c.id === activeClipId) || clips[0] || null;
  const hasApiKey = !!(settings?.videoAutoEditApiKey);

  // BUG FIX — "when I try to slice or trim a clip it doesn't let me play
  // it, it's rough." URL.createObjectURL(activeClip.file) was called
  // INLINE in the video's src prop — every re-render (typing in a trim
  // number field, editing a caption, anything) created a BRAND NEW blob
  // URL, and React swapping the <video>'s src to a new (even though
  // functionally identical) URL forces the browser to reload the video
  // from scratch, killing playback position/state every time. One stable
  // URL per clip, created once and reused across re-renders, and revoked
  // when that clip is actually removed (not on every render) — fixes both
  // the playback reset and a real blob-URL memory leak.
  const clipUrlCacheRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const cache = clipUrlCacheRef.current;
    const liveIds = new Set(clips.map(c => c.id));
    for (const [id, url] of cache) {
      if (!liveIds.has(id)) { URL.revokeObjectURL(url); cache.delete(id); }
    }
    for (const c of clips) {
      if (!cache.has(c.id)) cache.set(c.id, URL.createObjectURL(c.file));
    }
  }, [clips]);
  useEffect(() => () => { clipUrlCacheRef.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  const activeClipUrl = activeClip ? clipUrlCacheRef.current.get(activeClip.id) : undefined;

  useEffect(() => {
    if (!activeClipId && clips.length > 0) setActiveClipId(clips[0].id);
  }, [clips, activeClipId]);

  // Reset state whenever the modal is freshly opened, not left over from a
  // previous editing session (the modal instance is reused, not remounted).
  useEffect(() => {
    if (open) { setClips([]); setCaptions([]); setActiveClipId(null); setSilenceRanges([]); setRendering(false); }
  }, [open]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newClips: EditorClip[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("video/")) { toast?.(`${file.name} isn't a video — skipped`, "yellow"); continue; }
      const dur = await readVideoDuration(file);
      newClips.push({ id: uid(), file, startSec: 0, endSec: dur, durationSec: dur });
    }
    if (newClips.length > 0) {
      setClips(prev => [...prev, ...newClips]);
      toast?.(`Added ${newClips.length} clip${newClips.length > 1 ? "s" : ""} ✓`);
    }
  };

  const moveClip = (id: string, dir: -1 | 1) => {
    setClips(prev => {
      const i = prev.findIndex(c => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const removeClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
    setSilenceRanges(prev => prev.filter(r => r.clipId !== id));
  };

  const updateClip = (id: string, patch: Partial<EditorClip>) => setClips(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));

  const runAutoCut = async () => {
    if (!activeClip) { toast?.("Add a clip first", "red"); return; }
    setDetectingSilence(true);
    try {
      const ranges = await detectSilence(activeClip.file);
      if (ranges.length === 0) { toast?.("No significant silence found in this clip", "yellow"); return; }
      setSilenceRanges(prev => [...prev.filter(r => r.clipId !== activeClip.id), ...ranges.map(r => ({ clipId: activeClip.id, ...r }))]);
      toast?.(`Found ${ranges.length} quiet stretch${ranges.length > 1 ? "es" : ""} — review below and trim if you want`, "green");
    } catch (e: any) {
      toast?.("Auto-cut failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setDetectingSilence(false);
    }
  };

  const addCaption = () => {
    if (!activeClip) { toast?.("Add a clip first", "red"); return; }
    const start = Math.min(previewTime, activeClip.durationSec - 1);
    setCaptions(prev => [...prev, { id: uid(), text: "New caption", startSec: Math.max(0, start), endSec: Math.min(activeClip.durationSec, start + 2.5), styleId: CAPTION_STYLES[0].id }]);
  };

  // FEATURE — "can it automatically create captions?" Transcribes the
  // active clip's trimmed audio (OpenAI Whisper, via the owner's own
  // OpenAI key already set up for Alfred if they have one — no separate
  // signup needed) and turns each returned segment into a real, editable
  // caption with real timing — offset by however much timeline the clips
  // BEFORE this one already take up, so the timing lines up with the
  // assembled final video, not just this one clip in isolation.
  const runAutoCaptions = async () => {
    if (!activeClip) { toast?.("Add a clip first", "red"); return; }
    const apiKey = getCaptionApiKey(captionProvider);
    if (!apiKey) { toast?.(`Add a ${CAPTION_PROVIDERS.find(p => p.id === captionProvider)?.label} key to use auto-captions (or just type captions manually below — free, no key needed)`, "yellow"); return; }
    setTranscribing(true);
    try {
      const audioBlob = await extractAudioForTranscription(activeClip);
      const segments = await requestTranscription(audioBlob, captionProvider, apiKey);
      if (segments.length === 0) { toast?.("No speech detected in this clip", "yellow"); return; }
      const clipIndex = clips.findIndex(c => c.id === activeClip.id);
      const offsetSec = clips.slice(0, clipIndex).reduce((s, c) => s + Math.max(0, c.endSec - c.startSec), 0);
      const newCaptions: EditorCaption[] = segments.map(seg => ({
        id: uid(), text: seg.text, startSec: offsetSec + seg.start, endSec: offsetSec + seg.end, styleId: autoEditCaptionStyle,
      }));
      setCaptions(prev => [...prev, ...newCaptions]);
      toast?.(`Added ${newCaptions.length} caption${newCaptions.length > 1 ? "s" : ""} from the transcript ✓ — edit any that need fixing`, "green");
    } catch (e: any) {
      toast?.("Auto-captions failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setTranscribing(false);
    }
  };

  // FEATURE — "make it so you can auto edit, it auto cuts the dead spaces,
  // pieces the clips together, adds captions, you choose captions
  // templates, review it, can manually edit it, save, etc." One button
  // that: (1) splits every clip at its internal silences, replacing the
  // clip list with just the "keep" pieces — the existing render pipeline
  // already concatenates clips in array order, so that alone is "piecing
  // them together"; (2) transcribes every resulting piece and adds
  // captions in the style picked below; then leaves the owner right back
  // in this same editor with everything populated — "review it, manually
  // edit it, save" is just the editor's own existing clip/caption controls
  // and Render button, not a separate screen.
  const runAutoEdit = async () => {
    if (clips.length === 0) { toast?.("Add at least one clip first", "red"); return; }
    setAutoEditRunning(true);
    try {
      setAutoEditPhase("Cutting dead space…");
      const cutClips: EditorClip[] = [];
      for (let i = 0; i < clips.length; i++) {
        setAutoEditPhase(`Cutting dead space (clip ${i + 1}/${clips.length})…`);
        const pieces = await autoCutClipDeadSpace(clips[i]);
        cutClips.push(...pieces);
      }
      setClips(cutClips);
      setActiveClipId(cutClips[0]?.id || null);

      const apiKey = getCaptionApiKey(captionProvider);
      if (apiKey) {
        setAutoEditPhase("Generating captions…");
        const newCaptions: EditorCaption[] = [];
        let offset = 0;
        for (let i = 0; i < cutClips.length; i++) {
          const c = cutClips[i];
          const dur = Math.max(0, c.endSec - c.startSec);
          setAutoEditPhase(`Transcribing (${i + 1}/${cutClips.length})…`);
          try {
            const audioBlob = await extractAudioForTranscription(c);
            const segments = await requestTranscription(audioBlob, captionProvider, apiKey);
            for (const seg of segments) newCaptions.push({ id: uid(), text: seg.text, startSec: offset + seg.start, endSec: offset + seg.end, styleId: autoEditCaptionStyle });
          } catch (e: any) {
            console.warn("[Auto-Edit] transcription failed for a clip, continuing:", e?.message);
          }
          offset += dur;
        }
        setCaptions(prev => [...prev, ...newCaptions]);
        toast?.(`Auto-edit done — cut down to ${cutClips.length} clip${cutClips.length > 1 ? "s" : ""} and added ${newCaptions.length} caption${newCaptions.length === 1 ? "" : "s"}. Review below, edit anything, then render ✓`, "green");
      } else {
        toast?.(`Auto-edit done — cut down to ${cutClips.length} clip${cutClips.length > 1 ? "s" : ""}. Add a captions API key to also auto-generate captions, or add them manually below ✓`, "green");
      }
    } catch (e: any) {
      toast?.("Auto-edit failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setAutoEditRunning(false);
      setAutoEditPhase("");
    }
  };

  const updateCaption = (id: string, patch: Partial<EditorCaption>) => setCaptions(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  const removeCaption = (id: string) => setCaptions(prev => prev.filter(c => c.id !== id));

  const activeCaption = captions.find(c => c.startSec <= previewTime && previewTime <= c.endSec);
  const activeCaptionStyle = activeCaption ? getCaptionStyle(activeCaption.styleId) : null;

  const doExport = async () => {
    if (clips.length === 0) { toast?.("Add at least one clip first", "red"); return; }
    setRendering(true);
    setRenderPhase("Starting…");
    setRenderPct(0);
    try {
      const blob = await renderFinalVideo(clips, captions, (phase, pct) => { setRenderPhase(phase); setRenderPct(pct); }, aspectRatio);
      onExported(blob, saveAsDraftOnly);
      toast?.(saveAsDraftOnly ? "Video saved as a draft ✓" : "Video rendered ✓", "green");
      onClose();
    } catch (e: any) {
      console.error("[VideoEditor] export failed:", e);
      toast?.("Export failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setRendering(false);
    }
  };

  // Calls the owner's own configured video-editing API (functions/api/
  // video-autoedit.ts, currently wired for Shotstack) — entirely separate
  // code path from the free ffmpeg.wasm export above, only reachable when
  // a key exists. Shotstack renders from public URLs, not local files, so
  // this uploads each clip to Storage first (same uploadJobMedia path as
  // every other media attach in this app) before submitting the render.
  const doAutoEditWithApi = async () => {
    if (!hasApiKey) return;
    if (clips.length === 0) { toast?.("Add at least one clip first", "red"); return; }
    setAutoEditing(true);
    try {
      toast?.("Uploading clips…");
      const uploaded: { url: string; startSec: number; endSec: number }[] = [];
      for (const c of clips) {
        const url = await uploadJobMedia(c.file, `social/autoedit-${uid()}.mp4`, c.file.type || "video/mp4");
        if (!url) throw new Error(`Failed to upload ${c.file.name}`);
        uploaded.push({ url, startSec: c.startSec, endSec: c.endSec });
      }
      const resp = await fetch("/api/video-autoedit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.videoAutoEditApiKey,
          clips: uploaded,
          captions: captions.map(c => ({ text: c.text, startSec: c.startSec, endSec: c.endSec })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok && resp.status !== 202) throw new Error(data.error || `HTTP ${resp.status}`);
      if (data.pending) { toast?.(data.message || "Still rendering — check your Shotstack dashboard shortly", "yellow"); return; }
      if (data.url) {
        const videoRes = await fetch(data.url);
        const blob = await videoRes.blob();
        onExported(blob);
        toast?.("AI auto-edit rendered ✓", "green");
        onClose();
      }
    } catch (e: any) {
      toast?.("Auto-edit failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setAutoEditing(false);
    }
  };

  return (
    <Modal open={open} onClose={rendering ? () => {} : onClose} title="Video Editor" maxW="max-w-3xl">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={CAPTION_GOOGLE_FONTS_HREF} rel="stylesheet" />
      {/* FEATURE — "make the video editor mobile-friendly, not just PC."
          Every <input>/<select> below gets font-size:16px specifically —
          anything smaller triggers iOS Safari's auto-zoom-on-focus, which
          on a modal this dense means the whole editor jumps and reflows
          every time a field is tapped. Buttons get a minimum 40px tap
          target (Apple/Google's own accessibility minimum) since several
          were icon-only at 12-14px with no padding, fine with a mouse
          cursor but genuinely hard to hit accurately with a thumb. */}
      <style>{`
        .ve-input, .ve-select { font-size: 16px !important; }
        .ve-tap { min-width: 40px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; }
        @keyframes ve-anim-pop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes ve-anim-bounce { 0% { transform: translateY(24px); opacity: 0; } 60% { transform: translateY(-6px); opacity: 1; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes ve-anim-slide-up { 0% { transform: translateY(40px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes ve-anim-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes ve-anim-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
        @keyframes ve-anim-typewriter { 0% { clip-path: inset(0 100% 0 0); } 100% { clip-path: inset(0 0 0 0); } }
        @keyframes ve-anim-flicker { 0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; } 20%, 22%, 24%, 55% { opacity: 0.3; } }
      `}</style>

      {rendering ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-red-600/20 border-t-red-600 animate-spin" />
          <div className="text-sm font-semibold text-white">{renderPhase}</div>
          <div className="max-w-xs mx-auto h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-red-600 transition-all" style={{ width: `${renderPct}%` }} />
          </div>
          <div className="text-[11px] text-white/40">Rendering happens on this device — don't close the tab.</div>
        </div>
      ) : autoEditRunning ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-purple-600/20 border-t-purple-500 animate-spin" />
          <div className="text-sm font-semibold text-white">{autoEditPhase}</div>
          <div className="text-[11px] text-white/40">Auto-editing happens on this device — don't close the tab.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* FEATURE — "change the frame size, like 9:16, etc." Real output
              dimensions, not just a preview affectation — see
              ASPECT_DIMENSIONS in videoEditor.ts, which renderFinalVideo
              actually reframes (scale+crop) every clip to match. */}
          <div className="flex items-center justify-center gap-1.5">
            {ASPECT_RATIOS.map(ar => (
              <button key={ar} onClick={() => setAspectRatio(ar)} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition " + (aspectRatio === ar ? "border-red-500/50 bg-red-950/30 text-red-300" : "border-white/10 text-white/50 hover:text-white")}>
                {ar}
              </button>
            ))}
          </div>

          {/* Preview — taller on narrow/mobile viewports (more of the
              screen is naturally available in portrait) than the old fixed
              360px cap, which left a cramped preview on phones. */}
          <div
            ref={previewBoxRef}
            onClick={e => {
              if (!positioningCaptionId || !previewBoxRef.current) return;
              const rect = previewBoxRef.current.getBoundingClientRect();
              const xPct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              const yPct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
              updateCaption(positioningCaptionId, { xPct, yPct });
            }}
            className={"relative rounded-xl overflow-hidden bg-black max-h-[60vh] sm:max-h-[360px] mx-auto " + (positioningCaptionId ? "cursor-crosshair ring-2 ring-red-500" : "") + " " + (aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "1:1" ? "aspect-square" : "aspect-video")}
          >
            {activeClip ? (
              <video
                ref={videoRef}
                key={activeClip.id}
                src={activeClipUrl}
                controls={!positioningCaptionId}
                className="w-full h-full object-contain"
                style={{ transform: `${activeClip.rotation ? `rotate(${activeClip.rotation}deg)` : ""} ${activeClip.flipH ? "scaleX(-1)" : ""}`.trim() || undefined }}
                onTimeUpdate={e => setPreviewTime((e.target as HTMLVideoElement).currentTime)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">Add a clip to preview</div>
            )}
            {activeCaption && activeCaptionStyle && (
              <div
                className="absolute left-0 right-0 flex justify-center px-4 pointer-events-none text-center"
                style={
                  activeCaption.xPct !== undefined && activeCaption.yPct !== undefined
                    ? { left: `${activeCaption.xPct * 100}%`, top: `${activeCaption.yPct * 100}%`, right: "auto", transform: "translate(-50%, -50%)", width: "90%" }
                    : {
                        top: activeCaptionStyle.position === "top" ? "10%" : activeCaptionStyle.position === "center" ? "45%" : undefined,
                        bottom: activeCaptionStyle.position === "bottom" ? "8%" : undefined,
                      }
                }
              >
                <span
                  key={activeCaption.id}
                  style={{ ...captionStyleToCss(activeCaptionStyle), fontSize: "5.5vw", lineHeight: 1.2, display: "inline-block", animation: activeCaptionStyle.animation !== "none" ? `ve-anim-${activeCaptionStyle.animation} 0.4s ease-out` : undefined }}
                >{activeCaption.text}</span>
              </div>
            )}
            {positioningCaptionId && (
              <div className="absolute inset-x-0 bottom-2 text-center text-[10px] text-white bg-black/70 py-1 pointer-events-none">Tap anywhere to place this caption</div>
            )}
          </div>
          {positioningCaptionId && (
            <button onClick={() => setPositioningCaptionId(null)} className="w-full text-center text-xs text-red-400 hover:text-red-300 font-semibold -mt-3">Done positioning</button>
          )}

          {/* FEATURE — "make it so you can auto edit." One button that
              chains auto-cut-dead-space + auto-captions across every clip
              in the timeline (not just the active one), applying whichever
              caption template and transcription provider are picked here —
              then hands control right back to the normal editor below so
              the result can be reviewed, manually adjusted, and rendered
              exactly like a manual edit. */}
          {clips.length > 0 && (
            <div className="p-3 rounded-xl bg-purple-950/15 border border-purple-700/30 space-y-2.5">
              <div className="text-xs font-semibold text-purple-300 flex items-center gap-1.5"><Clapperboard size={13} />Auto-Edit</div>
              <div className="text-[10px] text-white/40">Cuts dead air out of every clip, stitches what's left together, and captions it in one pass — you still get to review and tweak everything after.</div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[9px] text-white/40 block mb-1">Captions from</label>
                  <select value={captionProvider} onChange={e => setCaptionProvider(e.target.value as CaptionProvider)} className="ve-select w-full bg-black/30 border border-white/10 rounded-lg px-1.5 py-1.5 text-white">
                    {CAPTION_PROVIDERS.map(p => <option key={p.id} value={p.id} className="bg-black">{p.label}{!p.keyFrom(settings) ? " (no key)" : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-white/40 block mb-1">Caption template</label>
                  <select value={autoEditCaptionStyle} onChange={e => setAutoEditCaptionStyle(e.target.value)} className="ve-select w-full bg-black/30 border border-white/10 rounded-lg px-1.5 py-1.5 text-white">
                    {CAPTION_STYLES.map(s => <option key={s.id} value={s.id} className="bg-black">{s.name}</option>)}
                  </select>
                </div>
              </div>
              {!getCaptionApiKey(captionProvider) && (
                <div className="text-[10px] text-yellow-400/80">No key for this provider yet — Auto-Edit will still cut dead space, just without captions.</div>
              )}
              <button onClick={runAutoEdit} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 border border-purple-600/50 text-purple-200 text-xs font-semibold transition">
                <Sparkles size={13} />Run Auto-Edit
              </button>
            </div>
          )}

          {/* Clips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wide flex items-center gap-1.5"><Scissors size={12} />Clips ({clips.length})</div>
              <button onClick={() => fileInputRef.current?.click()} className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 py-2 px-1"><Upload size={11} />Add clips</button>
              <input ref={fileInputRef} type="file" accept="video/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
            </div>
            {clips.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-xs border border-dashed border-white/10 rounded-xl">No clips yet — add one or more videos to build your edit</div>
            ) : (
              <div className="space-y-2">
                {clips.map((c, i) => {
                  const clipSilences = silenceRanges.filter(r => r.clipId === c.id);
                  return (
                    <div key={c.id} className={"p-2.5 rounded-xl border transition " + (activeClipId === c.id ? "bg-red-950/20 border-red-700/40" : "bg-white/5 border-white/10")}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setActiveClipId(c.id)} className="flex-1 text-left text-xs font-medium text-white truncate py-2">{i + 1}. {c.file.name}</button>
                        {/* FEATURE — "flip videos at different degrees, it
                            should snap at certain angles." Snaps through
                            0→90→180→270→0 — clean, lossless-shape rotation. */}
                        <button onClick={() => updateClip(c.id, { rotation: (((c.rotation || 0) + 90) % 360) as any })} title="Rotate 90°" className={"ve-tap " + ((c.rotation || 0) !== 0 ? "text-red-400" : "text-white/40 hover:text-white")}><RotateCw size={16} /></button>
                        <button onClick={() => updateClip(c.id, { flipH: !c.flipH })} title="Flip horizontal" className={"ve-tap " + (c.flipH ? "text-red-400" : "text-white/40 hover:text-white")}><FlipHorizontal size={16} /></button>
                        <button onClick={() => moveClip(c.id, -1)} disabled={i === 0} className="ve-tap text-white/40 hover:text-white disabled:opacity-20"><ChevronUp size={16} /></button>
                        <button onClick={() => moveClip(c.id, 1)} disabled={i === clips.length - 1} className="ve-tap text-white/40 hover:text-white disabled:opacity-20"><ChevronDown size={16} /></button>
                        <button onClick={() => removeClip(c.id)} className="ve-tap text-red-400/60 hover:text-red-400"><Trash2 size={16} /></button>
                      </div>
                      {/* Dual range sliders — the easier mobile-friendly way
                          to trim (drag with a thumb) — alongside the number
                          inputs for anyone who wants exact values. */}
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/40 w-8 flex-shrink-0">Start</span>
                          <input type="range" min={0} max={c.durationSec} step={0.1} value={c.startSec}
                            onChange={e => updateClip(c.id, { startSec: Math.min(Number(e.target.value), c.endSec - 0.1) })}
                            className="flex-1 accent-red-600" style={{ height: 24 }} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/40 w-8 flex-shrink-0">End</span>
                          <input type="range" min={0} max={c.durationSec} step={0.1} value={c.endSec}
                            onChange={e => updateClip(c.id, { endSec: Math.max(Number(e.target.value), c.startSec + 0.1) })}
                            className="flex-1 accent-red-600" style={{ height: 24 }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/50">
                        <span>Trim:</span>
                        <input type="number" min={0} max={c.durationSec} step={0.1} value={c.startSec.toFixed(1)}
                          onChange={e => updateClip(c.id, { startSec: Math.min(Number(e.target.value) || 0, c.endSec - 0.1) })}
                          className="ve-input w-16 bg-black/30 border border-white/10 rounded px-1.5 py-1.5 text-white" />
                        <span>to</span>
                        <input type="number" min={0} max={c.durationSec} step={0.1} value={c.endSec.toFixed(1)}
                          onChange={e => updateClip(c.id, { endSec: Math.max(Number(e.target.value) || 0, c.startSec + 0.1) })}
                          className="ve-input w-16 bg-black/30 border border-white/10 rounded px-1.5 py-1.5 text-white" />
                        <span>of {c.durationSec.toFixed(1)}s</span>
                      </div>
                      {/* Transition to the NEXT clip (hidden on the last
                          clip — nothing to transition into). Real ffmpeg
                          xfade/acrossfade effects, not a preview-only
                          affectation — see videoEditor.ts. */}
                      {i < clips.length - 1 && (
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/50">
                          <span className="flex-shrink-0">Transition to next →</span>
                          <select value={c.transitionToNext || "none"} onChange={e => updateClip(c.id, { transitionToNext: e.target.value })}
                            className="ve-select flex-1 bg-black/30 border border-white/10 rounded px-1.5 py-1.5 text-white">
                            {TRANSITION_EFFECTS.map(t => <option key={t.id} value={t.id} className="bg-black" title={t.description}>{t.name}</option>)}
                          </select>
                        </div>
                      )}
                      {clipSilences.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {clipSilences.map((r, si) => (
                            <div key={si} className="flex items-center justify-between text-[10px] bg-yellow-950/20 border border-yellow-700/30 rounded-lg px-2 py-1 text-yellow-200/80">
                              <span>Quiet: {r.start.toFixed(1)}s–{r.end.toFixed(1)}s</span>
                              <button
                                onClick={() => {
                                  // Trim the clip's end back to right before this
                                  // silent stretch, or nudge start forward if the
                                  // silence sits at the very beginning.
                                  if (r.start <= c.startSec + 0.3) updateClip(c.id, { startSec: r.end });
                                  else updateClip(c.id, { endSec: r.start });
                                  setSilenceRanges(prev => prev.filter(x => x !== r));
                                }}
                                className="text-yellow-300 hover:text-yellow-100 font-semibold"
                              >Trim it</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {activeClip && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button onClick={runAutoCut} disabled={detectingSilence}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-semibold transition disabled:opacity-40">
                  <Wand2 size={12} />{detectingSilence ? "Analyzing…" : "Auto-Cut Silence"}
                </button>
                <button onClick={runAutoCaptions} disabled={transcribing}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-semibold transition disabled:opacity-40">
                  <Captions size={12} />{transcribing ? "Transcribing…" : "Auto-Captions"}
                </button>
              </div>
            )}
          </div>

          {/* Captions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wide flex items-center gap-1.5"><Type size={12} />Captions ({captions.length})</div>
              <button onClick={addCaption} className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 py-2 px-1"><Plus size={11} />Add at {previewTime.toFixed(1)}s</button>
            </div>
            {captions.length === 0 ? (
              <div className="text-center py-6 text-white/30 text-xs border border-dashed border-white/10 rounded-xl">No captions yet — type your own, no AI needed</div>
            ) : (
              <div className="space-y-2">
                {captions.map(cap => (
                  <div key={cap.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input value={cap.text} onChange={e => updateCaption(cap.id, { text: e.target.value })}
                        className="ve-input flex-1 bg-black/30 border border-white/10 rounded px-2 py-2 text-white" placeholder="Caption text" />
                      <button onClick={() => removeCaption(cap.id)} className="ve-tap text-red-400/60 hover:text-red-400 flex-shrink-0"><Trash2 size={15} /></button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-white/50">
                      <span>From</span>
                      <input type="number" min={0} step={0.1} value={cap.startSec.toFixed(1)} onChange={e => updateCaption(cap.id, { startSec: Number(e.target.value) || 0 })} className="ve-input w-16 bg-black/30 border border-white/10 rounded px-1 py-1.5 text-white" />
                      <span>to</span>
                      <input type="number" min={0} step={0.1} value={cap.endSec.toFixed(1)} onChange={e => updateCaption(cap.id, { endSec: Number(e.target.value) || 0 })} className="ve-input w-16 bg-black/30 border border-white/10 rounded px-1 py-1.5 text-white" />
                      <span>s</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select value={cap.styleId} onChange={e => updateCaption(cap.id, { styleId: e.target.value })} className="ve-select flex-1 bg-black/30 border border-white/10 rounded px-1.5 py-1.5 text-white">
                        {CAPTION_STYLES.map(s => <option key={s.id} value={s.id} className="bg-black">{s.name}</option>)}
                      </select>
                      {/* FEATURE — "move the text around." Tap, then tap
                          anywhere on the preview above to place it there —
                          a real per-caption override (see xPct/yPct), not
                          just the style's default top/center/bottom. */}
                      <button onClick={() => { setActiveClipId(activeClipId); setPreviewTime(cap.startSec); setPositioningCaptionId(cap.id); }}
                        className={"text-[11px] font-semibold px-2 py-1.5 rounded-lg border flex-shrink-0 " + (cap.xPct !== undefined ? "border-red-500/50 bg-red-950/30 text-red-300" : "border-white/10 text-white/50 hover:text-white")}>
                        Position
                      </button>
                      {cap.xPct !== undefined && (
                        <button onClick={() => updateCaption(cap.id, { xPct: undefined, yPct: undefined })} className="text-[10px] text-white/30 hover:text-white/60 flex-shrink-0">Reset</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto p-0.5">
              {CAPTION_STYLES.map(s => (
                <div key={s.id} className="rounded-lg bg-black border border-white/10 py-3 px-1.5 flex items-center justify-center text-center" title={s.description}>
                  <span style={{ ...captionStyleToCss(s), fontSize: 11 }}>{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI auto-edit (optional, owner's own key) */}
          {hasApiKey && (
            <button onClick={doAutoEditWithApi} disabled={autoEditing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs font-semibold transition disabled:opacity-40">
              <Sparkles size={13} />{autoEditing ? "Submitting…" : "Auto-Edit with AI (uses your configured video API)"}
            </button>
          )}
          {!hasApiKey && (
            <div className="text-[10px] text-white/30 text-center">
              Want fully automated AI editing? Add a video-editing API key in Settings → Integrations to unlock "Auto-Edit with AI" — optional, uses your own account.
            </div>
          )}

          {/* FEATURE — "edit videos, but save them and not post them." */}
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer justify-center">
            <input type="checkbox" checked={saveAsDraftOnly} onChange={e => setSaveAsDraftOnly(e.target.checked)} className="accent-red-600" />
            Save as a draft — don't open the post composer
          </label>
          <GBtn onClick={doExport} disabled={clips.length === 0} className="w-full !justify-center !py-3">
            {saveAsDraftOnly ? "Render & Save Draft" : "Render & Use This Video"}
          </GBtn>
        </div>
      )}
    </Modal>
  );
}
