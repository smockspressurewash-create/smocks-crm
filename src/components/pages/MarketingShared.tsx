import React, { useEffect, useRef, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";

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
    `}</style>
  );
}

export function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="lp-blob absolute -top-32 -left-24 w-96 h-96 rounded-full bg-red-700/20 blur-3xl" />
      <div className="lp-blob-slow absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-red-900/25 blur-3xl" />
      <div className="lp-blob absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-red-800/15 blur-3xl" />
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
            <svg viewBox="0 0 64 64" className="w-5 h-5" fill="none">
              <path d="M14 44 Q30 46 40 34 Q46 27 50 16" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" strokeOpacity="0.95"/>
              <circle cx="50" cy="16" r="5" fill="#ffffff"/>
              <circle cx="41" cy="32" r="3.3" fill="#ffffff" fillOpacity="0.85"/>
              <circle cx="32" cy="42" r="2.4" fill="#ffffff" fillOpacity="0.65"/>
            </svg>
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
              <svg viewBox="0 0 64 64" className="w-4 h-4" fill="none">
                <path d="M14 44 Q30 46 40 34 Q46 27 50 16" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" strokeOpacity="0.95"/>
                <circle cx="50" cy="16" r="5" fill="#ffffff"/>
                <circle cx="41" cy="32" r="3.3" fill="#ffffff" fillOpacity="0.85"/>
                <circle cx="32" cy="42" r="2.4" fill="#ffffff" fillOpacity="0.65"/>
              </svg>
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
