import React, { useEffect, useRef, useState } from "react";
import { Mic, Play, Pause, Send, Trash2 } from "lucide-react";

// Records and transcribes voice input — Whisper API when an OpenAI key is
// configured (more accurate, works on any browser), otherwise the browser's
// built-in SpeechRecognition (no key needed, Chromium-based browsers only).
//
// Two modes:
// - "dictate" (STT): transcript lands in the input box for the user to read,
//   edit, and send themselves via onTranscript(text, false). No audio kept.
// - "note": records actual audio for playback. On stop, nothing is sent yet —
//   the user hears it back and explicitly presses Send (or Discard). Only on
//   Send is the transcript produced and onTranscript(text, true) called.
export function VoiceMicButton({ onTranscript, apiKey, mode = "dictate" }: { onTranscript?: (text: string, autoSend: boolean) => void; apiKey?: any; mode?: "dictate" | "note" }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef("");
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const SpeechRecognitionCtor = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

  const transcribeWhisper = async (blob: Blob): Promise<string> => {
    const fd = new FormData();
    fd.append("file", blob, "voice.webm");
    fd.append("model", "whisper-1");
    fd.append("language", "en");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey },
      body: fd,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Transcription failed");
    return (data.text || "").trim();
  };

  const stopTimer = () => { clearInterval(timerRef.current); timerRef.current = null; };

  const startDictateRecognition = () => {
    if (!SpeechRecognitionCtor) { alert("Voice input isn't supported in this browser. Try Chrome, or add an OpenAI key in Settings for Whisper transcription."); return; }
    const rec = new SpeechRecognitionCtor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) onTranscript?.(text.trim(), false);
    };
    rec.onerror = () => { /* user cancelled or no speech — nothing to report */ };
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const startNoteRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];
      liveTranscriptRef.current = "";
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setPendingAudioUrl(URL.createObjectURL(blob));
      };
      mediaRef.current = mr;
      mr.start();

      // No OpenAI key — run browser speech recognition alongside the recorder
      // so a transcript is still available at Send time without a paid API.
      if (!apiKey && SpeechRecognitionCtor) {
        const rec = new SpeechRecognitionCtor();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (e: any) => {
          let text = "";
          for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + " ";
          liveTranscriptRef.current = text.trim();
        };
        rec.onerror = () => {};
        recognitionRef.current = rec;
        rec.start();
      }

      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
      setRecording(true);
    } catch {
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mode === "note") {
      mediaRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      recognitionRef.current?.stop();
      stopTimer();
    } else {
      recognitionRef.current?.stop();
    }
    setRecording(false);
  };

  const toggleRecording = () => {
    if (recording) { stopRecording(); return; }
    if (mode === "note") startNoteRecording();
    else startDictateRecognition();
  };

  const discardNote = () => {
    if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    setPendingAudioUrl(null);
    setPlaying(false);
    chunksRef.current = [];
    liveTranscriptRef.current = "";
  };

  const sendNote = async () => {
    setProcessing(true);
    try {
      let text = "";
      if (apiKey) {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        text = await transcribeWhisper(blob);
      } else {
        text = liveTranscriptRef.current;
      }
      if (text) onTranscript?.(text, true);
      else alert("Couldn't transcribe that — try again or type your message.");
    } catch (e: any) {
      alert(e?.message || "Transcription failed");
    } finally {
      setProcessing(false);
      discardNote();
    }
  };

  const togglePlayback = () => {
    if (!audioElRef.current) return;
    if (playing) { audioElRef.current.pause(); } else { audioElRef.current.play(); }
  };

  useEffect(() => () => { if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl); }, [pendingAudioUrl]);

  if (processing) return <div className="p-2 text-white/40"><div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>;

  // Pending voice note — playback + explicit Send/Discard, never auto-sent.
  if (pendingAudioUrl) {
    return (
      <div className="flex items-center gap-1.5 bg-purple-950/30 border border-purple-700/40 rounded-xl px-2 py-1.5">
        <audio ref={audioElRef} src={pendingAudioUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />
        <button onClick={togglePlayback} className="p-1.5 rounded-lg text-purple-300 hover:bg-purple-900/40">{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <span className="text-[11px] text-purple-200">{elapsed}s voice note</span>
        <button onClick={discardNote} title="Discard" className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-900/20"><Trash2 size={13} /></button>
        <button onClick={sendNote} title="Send" className="p-1.5 rounded-lg text-white bg-purple-700/50 hover:bg-purple-700/70 flex items-center gap-1"><Send size={13} /></button>
      </div>
    );
  }

  if (recording && mode === "note") {
    return (
      <button onClick={toggleRecording} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-600/40 text-red-300 animate-pulse" title="Click to stop recording">
        <Mic size={14} /><span className="text-[11px] font-mono">{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleRecording}
      title={recording ? "Click to stop recording" : mode === "note" ? "Record a voice note — listen back before sending" : "Dictate — transcript lands in the text box to review before sending"}
      className={"p-2 rounded-xl transition flex-shrink-0 " + (recording ? "bg-red-600/40 text-red-300 animate-pulse" : "text-white/40 hover:text-white/70 hover:bg-white/5")}
    >
      <Mic size={16} />
    </button>
  );
}
