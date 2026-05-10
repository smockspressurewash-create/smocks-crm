import React, { useState, useEffect, useRef } from 'react';

export function BeforeAfterSlider({ before, after }: any) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<any>(null);
  const dragging = useRef(false);

  const updatePos = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  };

  const onMouseDown = (e: any) => { dragging.current = true; updatePos(e.clientX); };
  const onMouseMove = (e: any) => { if (dragging.current) updatePos(e.clientX); };
  const onMouseUp = () => { dragging.current = false; };
  const onTouchStart = (e: any) => { dragging.current = true; updatePos(e.touches[0].clientX); };
  const onTouchMove = (e: any) => { if (dragging.current) { e.preventDefault(); updatePos(e.touches[0].clientX); } };

  useEffect(() => {
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full aspect-video rounded-xl overflow-hidden cursor-ew-resize select-none border border-red-900/30 mb-2" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}>
      <img src={after} alt="After" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: pos + "%" }}>
        <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-cover" style={{ minWidth: (100 / pos * 100) + "%", maxWidth: "none" }} />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: pos + "%", transform: "translateX(-50%)" }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-xl flex items-center justify-center" style={{ left: "50%" }}>
          <span className="text-gray-800 text-xs font-bold select-none">⇔</span>
        </div>
      </div>
      <div className="absolute top-2 left-2 text-[10px] bg-blue-600/90 text-white px-2 py-0.5 rounded font-bold uppercase">Before</div>
      <div className="absolute top-2 right-2 text-[10px] bg-green-600/90 text-white px-2 py-0.5 rounded font-bold uppercase">After</div>
    </div>
  );
}
