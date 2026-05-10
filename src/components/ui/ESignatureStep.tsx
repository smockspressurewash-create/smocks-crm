import React, { useState } from 'react';
import { GBtn } from './GBtn';
import { fmt } from '../../lib/utils';

export function ESignatureStep({ e, sigData, setSigData, canvasRef, startDraw, draw, stopDraw, clearSig, onBack, onNext }: any) {
  const [sigMode, setSigMode] = useState("draw");
  const [typedName, setTypedName] = useState("");

  const applyTypedSig = (name: string) => {
    setTypedName(name);
    if (!name.trim()) { setSigData(null); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1e3a8a";
    ctx.font = "italic 48px Georgia, serif";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 24, canvas.height / 2);
    setSigData(canvas.toDataURL());
  };

  const switchMode = (mode: string) => {
    setSigMode(mode);
    setSigData(null);
    setTypedName("");
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, 580, 160);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="font-semibold mb-1">E-Signature</div>
        <div className="text-xs text-white/60 mb-3">By signing below, you agree to the estimate total of <span className="text-red-400 font-bold">{fmt(e.total)}</span> and authorize Smock's Pressure Washing to perform the listed services.</div>
      </div>
      <div className="flex gap-2">
        {[["draw", "✍️ Draw"], ["type", "⌨️ Type Name"]].map(([m, l]) => (
          <button key={m} onClick={() => switchMode(m)} className={"flex-1 py-2 rounded-xl text-xs font-semibold border transition " + (sigMode === m ? "bg-blue-900/40 border-blue-500/60 text-blue-200" : "bg-black/30 border-white/10 text-white/50 hover:text-white")}>{l}</button>
        ))}
      </div>
      {sigMode === "draw" ? (
        <>
          <div className="bg-white rounded-xl overflow-hidden border-2 border-dashed border-gray-300">
            <canvas ref={canvasRef} width={580} height={160} className="w-full cursor-crosshair touch-none" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
          </div>
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Sign above with your finger or mouse</span>
            <button onClick={clearSig} className="text-red-400 hover:text-red-300">Clear</button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <input type="text" value={typedName} onChange={ev => applyTypedSig(ev.target.value)} placeholder="Type your full name" className="w-full bg-white text-blue-900 rounded-xl px-5 py-4 text-2xl focus:outline-none border-2 border-dashed border-gray-300" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }} />
          <canvas ref={canvasRef} width={580} height={100} className="hidden" />
          <div className="text-xs text-white/40">Your typed name serves as your electronic signature</div>
        </div>
      )}
      <div className="text-[10px] text-white/40 bg-black/40 border border-white/5 rounded-lg p-2">
        🔒 Electronic signature captured · {new Date().toLocaleString()} · Legally binding
      </div>
      <div className="flex gap-2">
        <GBtn variant="ghost" onClick={onBack} className="flex-1">← Back</GBtn>
        <GBtn onClick={onNext} disabled={!sigData} className="flex-1 !py-3 font-bold">Continue to Payment →</GBtn>
      </div>
    </div>
  );
}
