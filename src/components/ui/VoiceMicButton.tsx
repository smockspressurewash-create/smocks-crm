import React, { useState, useRef } from 'react';
import { Mic } from 'lucide-react';

export function VoiceMicButton({ onTranscript, apiKey }: any) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];
      mr.ondataavailable = (e: any) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const fd = new FormData();
          fd.append("file", blob, "voice.webm");
          fd.append("model", "whisper-1");
          fd.append("language", "en");
          const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: "Bearer " + apiKey },
            body: fd
          });
          const data = await res.json();
          if (data.text) onTranscript(data.text.trim());
        } catch (e) {
          console.error("Whisper error:", e);
        } finally {
          setProcessing(false);
        }
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  if (processing) return <div className="p-2 text-white/40"><div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <button
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
      title="Hold to record voice message (Whisper)"
      className={"p-2 rounded-xl transition flex-shrink-0 " + (recording ? "bg-red-600/40 text-red-300 animate-pulse" : "text-white/40 hover:text-white/70 hover:bg-white/5")}
    >
      <Mic size={16} />
    </button>
  );
}
