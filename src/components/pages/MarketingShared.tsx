import React, { useEffect, useRef, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { CrewBossMark } from "../ui/CrewBossMark";

// ─── Shared building blocks for CrewBoss's public marketing pages ─────────────
// Used by LandingPage.tsx (#/welcome), FeaturesPage.tsx (#/features),
// PricingPage.tsx (#/pricing), and AboutPage.tsx (#/about). Pulled out of
// LandingPage.tsx so the nav/footer/scroll-reveal/background treatment is
// defined once and every marketing page looks and feels like the same site
// instead of four independently-styled pages. See App.tsx's page-resolution
// useState + hashchange handler for how each of these routes is reached, and
// the "already-signed-in owner off the marketing/login pages" guard just
// above the login screen for why every one of these pages is only ever
// rendered when there's no active owner/employee session.

export type MarketingPage = "welcome" | "features" | "pricing" | "about";

// ─── Scroll-reveal wrapper ─────────────────────────────────────────────────
// Adds "is-visible" once the element crosses into the viewport, which
// MarketingStyles below turns into a fade+slide-up transition. Falls back to
// already-visible if IntersectionObserver isn't available (very old
// browsers / SSR-safety) rather than leaving content invisible.
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={"reveal " + (visible ? "reveal-visible " : "") + className}
      style={{ transitionDelay: visible ? delay + "ms" : "0ms" }}
    >
      {children}
    </div>
  );
}

// ─── Scoped styles: scroll-reveal + gradient blob motion ──────────────────
// Identical across every marketing page — render once per page (each page is
// its own top-level route/mount, so there's no dedupe concern with repeating
// a <style> tag the way there would be inside a single long-scroll page).
export function MarketingStyles() {
  return (
    <style>{`
      .reveal {
        opacity: 0;
        transform: translateY(24px);
        transition: opacity 0.7s ease, transform 0.7s ease;
      }
      .reveal-visible { opacity: 1; transform: translateY(0); }

      @keyframes lp-blob-float {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(20px, -30px) scale(1.08); }
        66% { transform: translate(-15px, 15px) scale(0.95); }
      }
      .lp-blob { animation: lp-blob-float 14s ease-in-out infinite; }
      .lp-blob-slow { animation: lp-blob-float 20s ease-in-out infinite reverse; }

      @keyframes lp-shimmer-text {
        0% { background-position: 0% 50%; }
        100% { background-position: 200% 50%; }
      }
      .lp-hero-gradient {
        background: linear-gradient(90deg, #fca5a5, #dc2626, #f87171, #dc2626, #fca5a5);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: lp-shimmer-text 6s linear infinite;
      }

      .lp-card-hover {
        transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
      }
      .lp-card-hover:hover {
        transform: translateY(-4px);
        border-color: rgba(220,38,38,0.5);
        box-shadow: 0 12px 32px -12px rgba(220,38,38,0.35);
      }

      @keyframes lp-sweep-move {
        0% { transform: translateX(-30%) rotate(8deg); }
        100% { transform: translateX(30%) rotate(8deg); }
      }
      .lp-sweep {
        background: linear-gradient(100deg, transparent 40%, rgba(220,38,38,0.06) 48%, rgba(248,113,113,0.1) 50%, rgba(220,38,38,0.06) 52%, transparent 60%);
        animation: lp-sweep-move 9s ease-in-out infinite alternate;
      }

      @keyframes lp-marquee-scroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .lp-marquee-track { animation: lp-marquee-scroll 26s linear infinite; }
      .lp-marquee:hover .lp-marquee-track { animation-play-state: paused; }

      @keyframes lp-pulse-dot {
        0%, 100% { opacity: 0.4; transform: scale(0.85); }
        50% { opacity: 1; transform: scale(1.15); }
      }
      .lp-pulse-dot { animation: lp-pulse-dot 1.8s ease-in-out infinite; }

      @keyframes lp-hero-glow-pulse-move {
        0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
      }
      .lp-hero-glow-pulse { animation: lp-hero-glow-pulse-move 4s ease-in-out infinite; }

      @keyframes lp-divider-sweep-move {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(320%); }
      }
      .lp-divider-sweep { animation: lp-divider-sweep-move 3.2s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .lp-blob, .lp-blob-slow, .lp-sweep, .lp-marquee-track, .lp-pulse-dot, .lp-hero-gradient, .lp-divider-sweep, .lp-hero-glow-pulse {
          animation: none !important;
        }
      }
    `}</style>
  );
}

export function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="lp-blob absolute -top-32 -left-24 w-96 h-96 rounded-full bg-red-700/20 blur-3xl" />
      <div className="lp-blob-slow absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-red-900/25 blur-3xl" />
      <div className="lp-blob absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-red-800/15 blur-3xl" />
      {/* FEATURE — "the landing page looks bad/basic, add moving animation
          throughout." A slow diagonal light sweep across the whole page,
          on top of the existing blob glow, so there's ambient motion behind
          every section, not just the hero. Cheap (single gradient, GPU
          transform only) and respects prefers-reduced-motion below. */}
      <div className="lp-sweep absolute -inset-y-full -inset-x-1/2 w-[200%]" />
    </div>
  );
}

// ─── Animated hero graphic — a pressure-washer spray rendered as real
// moving particle streaks (canvas, not a static image), grounded in the
// actual subject instead of generic decorative blobs. Sits behind the hero
// headline as its own bounded visual. Respects prefers-reduced-motion (skips
// straight to a static single frame) and pauses via IntersectionObserver
// when scrolled out of view so it never burns cycles for content further
// down the page.
export function HeroSprayCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    type Streak = { x: number; y: number; len: number; speed: number; angle: number; width: number; hue: number; life: number };
    let streaks: Streak[] = [];
    let raf = 0;
    let running = true;
    let w = 0, h = 0, dpr = 1;

    const spawn = (): Streak => {
      const angle = (28 + Math.random() * 10) * (Math.PI / 180); // consistent downward-right spray angle
      return {
        x: -40 - Math.random() * 200,
        y: Math.random() * h * 0.9,
        len: 90 + Math.random() * 160,
        speed: 8 + Math.random() * 11,
        angle,
        width: 2 + Math.random() * 3,
        hue: Math.random() > 0.3 ? 0 : 355, // mostly hot red, some white-hot
        life: 1,
      };
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const count = reduceMotion ? 0 : (w < 640 ? 30 : 58);
    streaks = Array.from({ length: count }, spawn);

    const drawStatic = () => {
      // Reduced-motion fallback: a single soft radial glow, no animation loop at all.
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.5);
      g.addColorStop(0, "rgba(220,38,38,0.18)");
      g.addColorStop(1, "rgba(220,38,38,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const s of streaks) {
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        if (s.x > w + 80 || s.y > h + 80) { Object.assign(s, spawn()); continue; }
        const x2 = s.x - Math.cos(s.angle) * s.len;
        const y2 = s.y - Math.sin(s.angle) * s.len;
        const grad = ctx.createLinearGradient(s.x, s.y, x2, y2);
        grad.addColorStop(0, `hsla(${s.hue}, 95%, ${s.hue === 0 ? 58 : 75}%, 1)`);
        grad.addColorStop(1, `hsla(${s.hue}, 95%, 50%, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };

    if (reduceMotion) { drawStatic(); }
    else { raf = requestAnimationFrame(draw); }

    const obs = new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting && !reduceMotion;
      if (running && !raf) raf = requestAnimationFrame(draw);
    }, { threshold: 0 });
    obs.observe(wrap);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      obs.disconnect();
    };
  }, []);

  return (
    // z-0 (not -z-10): an absolutely-positioned element with z-index:auto
    // paints AFTER normal-flow siblings regardless of DOM order, and a
    // negative z-index can just as easily sink BELOW an ancestor's own
    // solid background depending on where the nearest stacking context
    // lands — explicit z-0 here plus z-10 on the caller's text wrapper
    // gives a real, direct, unambiguous comparison between the two.
    <div ref={wrapRef} className={"absolute inset-0 pointer-events-none z-0 " + className}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ─── Thin animated divider — a moving light sweep across an otherwise plain
// horizontal rule, used between sections so motion isn't only concentrated
// in the hero.
export function SectionDivider() {
  return (
    <div className="relative h-px max-w-4xl mx-auto my-2 overflow-hidden">
      <div className="absolute inset-0 bg-white/10" />
      <div className="lp-divider-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
    </div>
  );
}

// ─── Infinite scrolling marquee of feature keywords — a common, very
// effective "this page is alive" technique on top of scroll-triggered
// reveals, which only animate once and then sit still. Pure CSS transform
// loop (two duplicated tracks back to back so it wraps seamlessly), pauses
// under prefers-reduced-motion via the .lp-marquee-track animation being
// disabled in MarketingStyles below.
export function MarketingMarquee({ items }: { items: string[] }) {
  const track = [...items, ...items];
  return (
    <div className="lp-marquee relative overflow-hidden border-y border-red-900/30 bg-gradient-to-r from-red-950/40 via-black to-red-950/40 py-3">
      <div className="lp-marquee-track flex items-center gap-10 w-max">
        {track.map((item, i) => (
          <span key={i} className="flex items-center gap-10 text-xs md:text-sm font-semibold tracking-wide text-white/70 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const NAV_LINKS: Array<{ page: MarketingPage; label: string }> = [
  { page: "features", label: "Features" },
  { page: "pricing", label: "Pricing" },
  { page: "about", label: "About" },
];

// ─── Persistent nav, shared across every marketing page ───────────────────
// `active` highlights the current page's link. `onNavigate` moves between
// marketing pages (App.tsx wires this to set both window.location.hash and
// its own `page` state — see App.tsx's navigateMarketing helper). `onGetStarted`
// is the existing Log In / Get Started hand-off to the login screen.
export function MarketingNav({
  active,
  onNavigate,
  onGetStarted,
}: {
  active: MarketingPage;
  onNavigate: (page: MarketingPage) => void;
  onGetStarted: () => void;
}) {
  const [navOpen, setNavOpen] = useState(false);

  const linkClass = (p: MarketingPage) =>
    "transition-colors " + (active === p ? "text-white font-semibold" : "hover:text-white");

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-black/60 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => onNavigate("welcome")}
          className="flex items-center gap-2.5"
          aria-label="CrewBoss home"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-900/40">
            <CrewBossMark className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">Crew<span className="text-red-500">Boss</span></span>
        </button>

        <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
          {NAV_LINKS.map(l => (
            <button key={l.page} onClick={() => onNavigate(l.page)} className={linkClass(l.page)}>
              {l.label}
            </button>
          ))}
          <button onClick={onGetStarted} className="text-white/70 hover:text-white transition-colors">
            Log In
          </button>
          <button
            onClick={onGetStarted}
            className="px-4 py-2 rounded-lg bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 transition-all font-semibold shadow-lg shadow-red-900/30 hover:shadow-red-700/40 hover:-translate-y-0.5"
          >
            Start Free Trial
          </button>
        </nav>

        <button className="md:hidden p-2 -mr-2 text-white/80" onClick={() => setNavOpen(o => !o)} aria-label="Toggle menu">
          {navOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {navOpen && (
        <div className="md:hidden border-t border-white/10 bg-black/95 px-4 py-4 space-y-3 animate-fade-in">
          {NAV_LINKS.map(l => (
            <button
              key={l.page}
              onClick={() => { setNavOpen(false); onNavigate(l.page); }}
              className={"block w-full text-left py-2 " + (active === l.page ? "text-white font-semibold" : "text-white/70")}
            >
              {l.label}
            </button>
          ))}
          <button onClick={() => { setNavOpen(false); onGetStarted(); }} className="w-full text-left py-2 text-white/70">
            Log In
          </button>
          <button
            onClick={() => { setNavOpen(false); onGetStarted(); }}
            className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-br from-red-600 to-red-800 font-semibold"
          >
            Start Free Trial
          </button>
        </div>
      )}
    </header>
  );
}

// ─── Persistent footer, shared across every marketing page ────────────────
export function MarketingFooter({
  onNavigate,
  onGetStarted,
}: {
  onNavigate: (page: MarketingPage) => void;
  onGetStarted: () => void;
}) {
  return (
    <footer className="border-t border-white/10 px-4 md:px-6 py-10 mt-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <button onClick={() => onNavigate("welcome")} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center">
              <CrewBossMark className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight text-white/70">Crew<span className="text-red-500">Boss</span></span>
          </button>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/40">
            <button onClick={() => onNavigate("features")} className="hover:text-white/70 transition-colors">Features</button>
            <button onClick={() => onNavigate("pricing")} className="hover:text-white/70 transition-colors">Pricing</button>
            <button onClick={() => onNavigate("about")} className="hover:text-white/70 transition-colors">About</button>
            <a href="#/terms" className="hover:text-white/70 transition-colors">Terms</a>
            <a href="#/privacy" className="hover:text-white/70 transition-colors">Privacy</a>
            <button onClick={onGetStarted} className="hover:text-white/70 transition-colors">Log In</button>
          </div>

          <div className="text-[11px] text-white/25">
            © {new Date().getFullYear()} CrewBoss. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Small reusable page-header block for the non-welcome marketing pages ──
export function MarketingPageHeader({
  eyebrow,
  title,
  gradientWord,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  gradientWord?: string;
  subtitle?: string;
}) {
  return (
    <section className="relative px-4 md:px-6 pt-14 pb-10 md:pt-20 md:pb-14 max-w-4xl mx-auto text-center">
      <Reveal>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-red-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-ring" />
          {eyebrow}
        </div>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-[1.08] mb-5">
          {title}
        </h1>
      </Reveal>
      {subtitle && (
        <Reveal delay={160}>
          <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        </Reveal>
      )}
    </section>
  );
}

// ─── Shared final CTA band, reused at the bottom of every inner marketing page
export function MarketingFinalCta({ onGetStarted, heading, body }: { onGetStarted: () => void; heading: string; body: string }) {
  return (
    <Reveal className="px-4 md:px-6">
      <section className="max-w-4xl mx-auto text-center py-16 md:py-20">
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-4">{heading}</h2>
        <p className="text-white/50 mb-8 text-sm md:text-base max-w-xl mx-auto">{body}</p>
        <button
          onClick={onGetStarted}
          className="group px-8 py-3.5 rounded-xl bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 font-bold text-base shadow-xl shadow-red-900/40 hover:shadow-red-700/50 transition-all hover:-translate-y-0.5 inline-flex items-center gap-2"
        >
          Start Free Trial
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </button>
      </section>
    </Reveal>
  );
}
