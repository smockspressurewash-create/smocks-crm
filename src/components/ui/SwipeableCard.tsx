import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function SwipeableCard({ job, stages = [], onMove, children }: any) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [swipeHint, setSwipeHint] = useState<"left" | "right" | null>(null);

  const currentIdx = stages.findIndex((s: any) => s.key === job.pipelineStage);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipeHint(null);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - (touchStartX.current as number);
    const dy = Math.abs(e.touches[0].clientY - (touchStartY.current as number));
    if (Math.abs(dx) > 20 && dy < 40) {
      setSwipeHint(dx > 0 ? "right" : "left");
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) { setSwipeHint(null); return; }
    const dx = e.changedTouches[0].clientX - (touchStartX.current as number);
    const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current as number));
    touchStartX.current = null;
    touchStartY.current = null;
    setSwipeHint(null);

    // Only trigger stage move if horizontal swipe > 60px and not mostly vertical
    if (Math.abs(dx) < 60 || dy > 60) return;

    if (dx > 0 && currentIdx > 0) {
      // Swipe right → move to previous stage
      onMove(job.id, stages[currentIdx - 1].key);
    } else if (dx < 0 && currentIdx < stages.length - 1) {
      // Swipe left → move to next stage
      const nextStage = stages[currentIdx + 1];
      if (nextStage.key === "lost") return; // don't auto-move to lost via swipe
      onMove(job.id, nextStage.key);
    }
  };

  return (
    <div
      className="pipeline-card relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: swipeHint === "left" ? "translateX(-6px)" : swipeHint === "right" ? "translateX(6px)" : "translateX(0)",
        transition: swipeHint ? "transform 0.1s ease" : "transform 0.2s ease",
      }}
    >
      {/* Swipe direction indicators */}
      {swipeHint === "right" && currentIdx > 0 && (
        <div className="absolute inset-0 rounded-xl bg-blue-500/15 border-2 border-blue-400/50 pointer-events-none z-10 flex items-center justify-start pl-2">
          <div className="text-[10px] text-blue-300 font-bold flex items-center gap-1 bg-blue-950/80 px-2 py-1 rounded-lg">
            <ChevronLeft size={12} />
            {stages[currentIdx - 1]?.label}
          </div>
        </div>
      )}
      {swipeHint === "left" && currentIdx < stages.length - 2 && (
        <div className="absolute inset-0 rounded-xl bg-green-500/15 border-2 border-green-400/50 pointer-events-none z-10 flex items-center justify-end pr-2">
          <div className="text-[10px] text-green-300 font-bold flex items-center gap-1 bg-green-950/80 px-2 py-1 rounded-lg">
            {stages[currentIdx + 1]?.label}
            <ChevronRight size={12} />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
