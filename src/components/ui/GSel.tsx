// GSel.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

// ISSUE (round 3) — replaced the native <select> with a custom listbox so
// the visible option list can be capped at 8 rows with a scrollbar, per
// owner request, across every GSel usage in the app (customer picker,
// priority, etc.) without touching the ~75 call sites — same props in
// (value/onChange/className/children as <option>), so this is a drop-in
// swap of the implementation only.
//
// Rendered via a PORTAL into document.body, not inline. Most GSel usages
// live inside Modal.tsx, whose card is overflow-hidden and whose body is
// overflow-y-auto — an inline absolutely-positioned panel would get
// silently clipped there. A native <select> is an OS-level overlay immune
// to any CSS overflow, which this has to reproduce by hand.
const GSEL_MAX_VISIBLE_ROWS = 8;
const GSEL_ROW_HEIGHT = 36;
// FEATURE (user report) — "whenever I'm choosing which customer it's for, I
// should be able to search them up: I start typing J-O and John shows up."
// Any list longer than this gets a search box at the top of the panel that
// filters as you type (every word you type must appear, any order, so "jo
// sm" finds John Smith). Covers every customer picker at once: estimates,
// jobs, work orders, invoices, reviews.
const GSEL_SEARCH_MIN_OPTIONS = 8;
const GSEL_SEARCH_HEIGHT = 44;

interface GSelOption { value: string; label: React.ReactNode; disabled?: boolean; }

// Flattens <option>/<optgroup>/fragment children into a flat option list.
const extractGSelOptions = (children: React.ReactNode): GSelOption[] => {
  const opts: GSelOption[] = [];
  React.Children.forEach(children, (child: any) => {
    if (!React.isValidElement(child)) return;
    const props: any = child.props;
    if (child.type === "option") {
      opts.push({ value: String(props.value ?? ""), label: props.children, disabled: !!props.disabled });
    } else if (props?.children) {
      opts.push(...extractGSelOptions(props.children));
    }
  });
  return opts;
};

// Plain-text form of an option's (possibly JSX) label, for type-ahead
// matching and the row's hover title — string concatenation, not the
// comma-joined mess String([a,b,c]) would produce for multi-child JSX like
// {firstName} {lastName}.
const gSelNodeToText = (node: React.ReactNode): string => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(gSelNodeToText).join("");
  if (React.isValidElement(node)) return gSelNodeToText((node as any).props?.children);
  return "";
};

export const GSel = ({ className = "", children, value, onChange, disabled, ...r }: any) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef({ text: "", timer: 0 as any });
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const allOptions = extractGSelOptions(children);
  const searchable = allOptions.length > GSEL_SEARCH_MIN_OPTIONS;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  // The blank "— Select —" row is hidden while searching; it isn't a match.
  const options = words.length
    ? allOptions.filter(o => o.value !== "" && words.every(w => gSelNodeToText(o.label).toLowerCase().includes(w)))
    : allOptions;
  const searchExtra = searchable ? GSEL_SEARCH_HEIGHT : 0;
  const selected = allOptions.find(o => o.value === String(value ?? ""));

  const computeCoords = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelHeight = Math.min(Math.max(allOptions.length, 1), GSEL_MAX_VISIBLE_ROWS) * GSEL_ROW_HEIGHT + 8 + searchExtra;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < panelHeight && rect.top > spaceBelow;
    // Opening upward is anchored by its bottom edge, so a list that shrinks
    // while searching stays against the dropdown instead of floating above.
    setCoords({
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      left: rect.left,
      width: rect.width,
    });
  }, [allOptions.length, searchExtra]);

  const closeDropdown = () => setOpen(false);

  const openDropdown = () => {
    if (disabled) return;
    computeCoords();
    const idx = Math.max(0, options.findIndex(o => o.value === String(value ?? "")));
    setHighlighted(idx);
    setQuery("");
    setOpen(true);
  };

  // One-shot: when the panel opens, jump straight to the already-selected
  // row if it's not one of the first 8 (otherwise the owner would have to
  // manually scroll down to find their own current selection). Deliberately
  // keyed on `open` only, not `highlighted` — see scrollRowIntoView's
  // comment for why a broader dependency caused real problems.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector(`[data-idx="${highlighted}"]`)?.scrollIntoView({ block: "nearest" });
    if (searchable) searchRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (opt: GSelOption) => {
    if (opt.disabled) return;
    onChange?.({ target: { value: opt.value } });
    closeDropdown();
    triggerRef.current?.focus();
  };

  // Close on outside click, an ANCESTOR scroll (capture:true also catches
  // the modal's own internal scroll container, not just window scroll —
  // that's what keeps a stale-positioned panel from ever being visible),
  // resize, or Escape. This is the simple/safe choice over repositioning
  // live.
  //
  // BUG FOUND VIA AUTOMATED TESTING — capture:true means this also sees the
  // dropdown PANEL's own internal scroll (e.g. auto-scrolling to reveal the
  // already-selected row on open, or the owner manually scrolling the list)
  // as a "some ancestor scrolled, the trigger's position may be stale"
  // event, immediately closing the panel that scroll was happening inside
  // of. Reopening a GSel with a selection past the first 8 rows closed
  // itself instantly. Skip scroll events whose target is the panel itself.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      closeDropdown();
    };
    const typing = () => !!searchRef.current && document.activeElement === searchRef.current;
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      if (typing()) { computeCoords(); return; }
      closeDropdown();
    };
    const onResize = () => { if (typing()) computeCoords(); else closeDropdown(); };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") { closeDropdown(); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Scrolls a row into view — called directly from keyboard/type-ahead
  // navigation only, NOT reactively off `highlighted` state. A reactive
  // useEffect keyed on `highlighted` also fires for plain MOUSE HOVER
  // (onMouseEnter sets `highlighted` too, for visual feedback), which was
  // re-running scrollIntoView on every row the cursor crossed while moving
  // toward a target further down the list — fighting the very scroll
  // gesture a real user needed to reach that row, and (found the hard way,
  // via an automated pointer-path click test) even fully detaching/
  // recreating the target element mid-click on a fast synthetic pointer
  // path. Rows are all rendered upfront (never virtualized), so the row
  // element already exists in the DOM the instant a new index is chosen —
  // no need to wait for a render to query it.
  const scrollRowIntoView = (idx: number) => {
    panelRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); openDropdown(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); const next = Math.min(options.length - 1, highlighted + 1); setHighlighted(next); scrollRowIntoView(next); }
    else if (e.key === "ArrowUp") { e.preventDefault(); const next = Math.max(0, highlighted - 1); setHighlighted(next); scrollRowIntoView(next); }
    else if (e.key === "Enter") { e.preventDefault(); const opt = options[highlighted]; if (opt) choose(opt); }
    else if (e.key === "Tab") { closeDropdown(); }
    else if (e.key.length === 1 && searchable) {
      // Typing on the focused trigger goes into the search box.
      e.preventDefault(); setQuery(q => q + e.key); setHighlighted(0); searchRef.current?.focus();
    }
    else if (e.key.length === 1) {
      // Type-ahead, matching native <select> letter-jump behavior.
      clearTimeout(typeaheadRef.current.timer);
      typeaheadRef.current.text += e.key.toLowerCase();
      const q = typeaheadRef.current.text;
      const match = options.findIndex(o => gSelNodeToText(o.label).toLowerCase().startsWith(q));
      if (match >= 0) { setHighlighted(match); scrollRowIntoView(match); }
      typeaheadRef.current.timer = setTimeout(() => { typeaheadRef.current.text = ""; }, 600);
    }
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={onTriggerKeyDown}
        className={"w-full bg-surface/40 backdrop-blur-md border border-edge/30 rounded-xl px-4 py-2.5 text-ink focus:outline-none focus:border-red-500/60 transition-all duration-200 flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed " + className}
        {...r}
      >
        <span className={"truncate " + (selected ? "" : "text-ink-soft/40")}>{selected ? selected.label : (options[0]?.label ?? "")}</span>
        <ChevronDown size={14} className={"flex-shrink-0 text-ink-soft/40 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && coords && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: coords.top, bottom: coords.bottom, left: coords.left, width: coords.width, maxHeight: Math.min(Math.max(allOptions.length, 1), GSEL_MAX_VISIBLE_ROWS) * GSEL_ROW_HEIGHT + 8 + searchExtra, zIndex: 500 }}
          className="overflow-y-auto bg-neutral-950 border border-red-900/40 rounded-xl shadow-2xl py-1"
        >
          {searchable && (
            <div className="sticky top-0 z-10 bg-neutral-950 px-2 pb-1" style={{ height: GSEL_SEARCH_HEIGHT }}>
              <input
                ref={searchRef}
                data-gsel-search
                value={query}
                onChange={e => { setQuery(e.target.value); setHighlighted(0); panelRef.current?.scrollTo({ top: 0 }); }}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { e.preventDefault(); const next = Math.min(options.length - 1, highlighted + 1); setHighlighted(next); scrollRowIntoView(next); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); const next = Math.max(0, highlighted - 1); setHighlighted(next); scrollRowIntoView(next); }
                  else if (e.key === "Enter") { e.preventDefault(); const opt = options[highlighted]; if (opt) choose(opt); }
                  else if (e.key === "Tab") closeDropdown();
                }}
                placeholder="Type to search…"
                autoComplete="off"
                enterKeyHint="search"
                className="w-full h-9 mt-0.5 bg-white/5 border border-white/10 rounded-lg px-3 text-[16px] md:text-sm text-white placeholder-white/35 focus:outline-none focus:border-red-500/60"
              />
            </div>
          )}
          {options.map((opt, i) => (
            <div
              key={opt.value + ":" + i}
              data-idx={i}
              title={gSelNodeToText(opt.label)}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => choose(opt)}
              style={{ height: GSEL_ROW_HEIGHT }}
              className={"px-4 text-sm truncate flex items-center " +
                (opt.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer") + " " +
                (i === highlighted ? "bg-red-900/40 text-white" : "text-white/80") +
                (opt.value === String(value ?? "") ? " font-semibold" : "")}
            >
              {opt.label}
            </div>
          ))}
          {options.length === 0 && <div className="px-4 text-sm text-white/30 flex items-center" style={{ height: GSEL_ROW_HEIGHT }}>{words.length ? `No match for "${query.trim()}"` : "No options"}</div>}
        </div>,
        document.body
      )}
    </>
  );
};
const GTxt = ({ className = "", ...r }) => <textarea className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-red-500/60 transition-all duration-200 resize-none " + className} {...r} />;

// Inject CSS into document.head — works in artifact sandbox unlike <style> tags in JSX
const useGlobalStyles = () => {
  useEffect(() => {
    const id = "smocks-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      @keyframes smockFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes smockPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
      @keyframes smockSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes smockFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      @keyframes smockSlideRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
      @keyframes smockScale { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
      @keyframes smockShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      @keyframes smockToastIn { from{opacity:0;transform:translateX(110%)} to{opacity:1;transform:translateX(0)} }
      @keyframes smockGlow { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0)} 50%{box-shadow:0 0 20px 4px rgba(220,38,38,.15)} }
      .anim-float { animation: smockFloat 5s ease-in-out infinite; }
      .anim-pulse { animation: smockPulse 2s ease-in-out infinite; }
      .anim-spin-slow { animation: smockSpin 10s linear infinite; }
      .anim-fade-up { animation: smockFadeUp .4s cubic-bezier(.16,1,.3,1) both; }
      .anim-slide-right { animation: smockSlideRight .3s cubic-bezier(.16,1,.3,1) both; }
      .anim-scale { animation: smockScale .25s cubic-bezier(.34,1.4,.64,1) both; }
      .anim-toast { animation: smockToastIn .35s cubic-bezier(.16,1,.3,1) both; }
      .anim-glow { animation: smockGlow 2.5s ease-in-out infinite; }
      .glass-hover { transition: border-color .2s,box-shadow .2s,transform .15s; }
      .glass-hover:hover { box-shadow: 0 0 0 1px rgba(220,38,38,.3), 0 8px 32px -8px rgba(0,0,0,.9); border-color: rgba(220,38,38,.4) !important; }
      .glass-hover:active { transform: scale(.997); }
      .btn-hover { transition: transform .15s, box-shadow .15s; }
      .btn-hover:hover { transform: translateY(-1px); box-shadow: 0 4px 20px -4px rgba(220,38,38,.4); }
      .btn-hover:active { transform: scale(.97); }
      .shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent); background-size: 200%; animation: smockShimmer 2s infinite; }
      ::-webkit-scrollbar { width: 3px; height: 3px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(220,38,38,.35); border-radius: 2px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(220,38,38,.6); }
      input[type=date]::-webkit-calendar-picker-indicator { filter:invert(1); opacity:.6; }
      input[type=range] { accent-color: #dc2626; }
      input[type=checkbox] { accent-color: #dc2626; }
    `;
    document.head.appendChild(el);
    return () => { /* keep it — no cleanup needed */ };
  }, []);
};

// Page transition wrapper — fade-in-up on page change
