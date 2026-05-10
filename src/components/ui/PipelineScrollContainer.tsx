import React, { useRef } from 'react';

export function PipelineScrollContainer({ children }: any) {
  const ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  // Mouse drag-to-scroll (desktop)
  const onMouseDown = (e: any) => {
    // Only scroll if clicking on the container bg, not on cards
    if (e.target.closest(".pipeline-card")) return;
    isDragging.current = true;
    startX.current = e.pageX - (ref.current?.offsetLeft || 0);
    scrollStart.current = ref.current?.scrollLeft || 0;
    if (ref.current) {
      ref.current.style.cursor = "grabbing";
      ref.current.style.userSelect = "none";
    }
  };
  const onMouseMove = (e: any) => {
    if (!isDragging.current) return;
    const x = e.pageX - (ref.current?.offsetLeft || 0);
    const walk = (x - startX.current) * 1.5;
    if (ref.current) ref.current.scrollLeft = scrollStart.current - walk;
  };
  const onMouseUp = () => {
    isDragging.current = false;
    if (ref.current) { 
      ref.current.style.cursor = ""; 
      ref.current.style.userSelect = ""; 
    }
  };

  return (
    <>
      <style>{`
        .pipeline-scroll::-webkit-scrollbar { height: 8px; }
        .pipeline-scroll::-webkit-scrollbar-track { background: rgba(127,29,29,0.15); border-radius: 4px; }
        .pipeline-scroll::-webkit-scrollbar-thumb { background: rgba(220,38,38,0.55); border-radius: 4px; border: 1px solid rgba(220,38,38,0.2); }
        .pipeline-scroll::-webkit-scrollbar-thumb:hover { background: rgba(220,38,38,0.8); }
        .pipeline-scroll { scrollbar-width: thick; scrollbar-color: rgba(220,38,38,0.55) rgba(127,29,29,0.15); }
      `}</style>
      <div
        ref={ref}
        className="pipeline-scroll overflow-x-auto pb-3 -mx-1"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {children}
      </div>
    </>
  );
}
