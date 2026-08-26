// FEATURE — CapCut-style video editor inside the Social section: upload
// clips, trim/reorder them, auto-detect+strip silence, add styled
// captions with a live preview, and export a real rendered MP4 — all via
// ffmpeg.wasm in the browser (src/lib/videoEditor.ts), genuinely free with
// no per-render cost. An optional "Auto-Edit with AI" button appears only
// when the owner has configured their own video-API key in Settings (see
// functions/api/video-autoedit.ts) — kept fully separate from the free
// path so nothing here silently starts costing money without the owner
// explicitly opting in with their own account.
import React, { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { Plus, Trash2, ChevronUp, ChevronDown, Wand2, Scissors, Type, Upload, Sparkles } from "lucide-react";
import { uid, uploadJobMedia } from "../../lib/utils";
import { CAPTION_STYLES, CAPTION_GOOGLE_FONTS_HREF, captionStyleToCss, getCaptionStyle } from "../../lib/captionStyles";
import { readVideoDuration, detectSilence, renderFinalVideo, type EditorClip, type EditorCaption } from "../../lib/videoEditor";

export function VideoEditorModal({ open, onClose, onExported, toast, settings }: {
  open: boolean;
  onClose: () => void;
  // Hands back the finished video as a Blob + a suggested filename — the
  // caller (SocialPage.tsx) owns uploading it to Storage and wiring it
  // into the post form, same as any other media attach path there.
  onExported: (blob: Blob) => void;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeClip = clips.find(c => c.id === activeClipId) || clips[0] || null;
  const hasApiKey = !!(settings?.videoAutoEditApiKey);

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
      const blob = await renderFinalVideo(clips, captions, (phase, pct) => { setRenderPhase(phase); setRenderPct(pct); });
      onExported(blob);
      toast?.("Video rendered ✓", "green");
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

      {rendering ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-red-600/20 border-t-red-600 animate-spin" />
          <div className="text-sm font-semibold text-white">{renderPhase}</div>
          <div className="max-w-xs mx-auto h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-red-600 transition-all" style={{ width: `${renderPct}%` }} />
          </div>
          <div className="text-[11px] text-white/40">Rendering happens on this device — don't close the tab.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Preview */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[360px] mx-auto">
            {activeClip ? (
              <video
                ref={videoRef}
                key={activeClip.id}
                src={URL.createObjectURL(activeClip.file)}
                controls
                className="w-full h-full object-contain"
                onTimeUpdate={e => setPreviewTime((e.target as HTMLVideoElement).currentTime)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">Add a clip to preview</div>
            )}
            {activeCaption && activeCaptionStyle && (
              <div
                className="absolute left-0 right-0 flex justify-center px-4 pointer-events-none text-center"
                style={{
                  top: activeCaptionStyle.position === "top" ? "10%" : activeCaptionStyle.position === "center" ? "45%" : undefined,
                  bottom: activeCaptionStyle.position === "bottom" ? "8%" : undefined,
                }}
              >
                <span style={{ ...captionStyleToCss(activeCaptionStyle), fontSize: "5.5vw", lineHeight: 1.2 }}>{activeCaption.text}</span>
              </div>
            )}
          </div>

          {/* Clips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wide flex items-center gap-1.5"><Scissors size={12} />Clips ({clips.length})</div>
              <button onClick={() => fileInputRef.current?.click()} className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"><Upload size={11} />Add clips</button>
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
                      <div className="flex items-center gap-2">
                        <button onClick={() => setActiveClipId(c.id)} className="flex-1 text-left text-xs font-medium text-white truncate">{i + 1}. {c.file.name}</button>
                        <button onClick={() => moveClip(c.id, -1)} disabled={i === 0} className="text-white/40 hover:text-white disabled:opacity-20"><ChevronUp size={14} /></button>
                        <button onClick={() => moveClip(c.id, 1)} disabled={i === clips.length - 1} className="text-white/40 hover:text-white disabled:opacity-20"><ChevronDown size={14} /></button>
                        <button onClick={() => removeClip(c.id)} className="text-red-400/60 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-white/50">
                        <span>Trim:</span>
                        <input type="number" min={0} max={c.durationSec} step={0.1} value={c.startSec.toFixed(1)}
                          onChange={e => updateClip(c.id, { startSec: Math.min(Number(e.target.value) || 0, c.endSec - 0.1) })}
                          className="w-16 bg-black/30 border border-white/10 rounded px-1.5 py-1 text-white" />
                        <span>to</span>
                        <input type="number" min={0} max={c.durationSec} step={0.1} value={c.endSec.toFixed(1)}
                          onChange={e => updateClip(c.id, { endSec: Math.max(Number(e.target.value) || 0, c.startSec + 0.1) })}
                          className="w-16 bg-black/30 border border-white/10 rounded px-1.5 py-1 text-white" />
                        <span>of {c.durationSec.toFixed(1)}s</span>
                      </div>
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
              <button onClick={runAutoCut} disabled={detectingSilence}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-semibold transition disabled:opacity-40">
                <Wand2 size={12} />{detectingSilence ? "Analyzing audio…" : "Auto-Cut Silence (selected clip)"}
              </button>
            )}
          </div>

          {/* Captions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wide flex items-center gap-1.5"><Type size={12} />Captions ({captions.length})</div>
              <button onClick={addCaption} className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"><Plus size={11} />Add at {previewTime.toFixed(1)}s</button>
            </div>
            {captions.length === 0 ? (
              <div className="text-center py-6 text-white/30 text-xs border border-dashed border-white/10 rounded-xl">No captions yet — type your own, no AI needed</div>
            ) : (
              <div className="space-y-2">
                {captions.map(cap => (
                  <div key={cap.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input value={cap.text} onChange={e => updateCaption(cap.id, { text: e.target.value })}
                        className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white" placeholder="Caption text" />
                      <button onClick={() => removeCaption(cap.id)} className="text-red-400/60 hover:text-red-400 flex-shrink-0"><Trash2 size={13} /></button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-white/50">
                      <span>From</span>
                      <input type="number" min={0} step={0.1} value={cap.startSec.toFixed(1)} onChange={e => updateCaption(cap.id, { startSec: Number(e.target.value) || 0 })} className="w-14 bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white" />
                      <span>to</span>
                      <input type="number" min={0} step={0.1} value={cap.endSec.toFixed(1)} onChange={e => updateCaption(cap.id, { endSec: Number(e.target.value) || 0 })} className="w-14 bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white" />
                      <span>s</span>
                      <select value={cap.styleId} onChange={e => updateCaption(cap.id, { styleId: e.target.value })} className="ml-auto bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-white">
                        {CAPTION_STYLES.map(s => <option key={s.id} value={s.id} className="bg-black">{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {CAPTION_STYLES.map(s => (
                <div key={s.id} className="rounded-lg bg-black border border-white/10 py-3 flex items-center justify-center" title={s.description}>
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

          <GBtn onClick={doExport} disabled={clips.length === 0} className="w-full !justify-center !py-3">
            Render & Use This Video
          </GBtn>
        </div>
      )}
    </Modal>
  );
}
