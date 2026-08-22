import React, { useEffect, useRef, useState } from "react";
import {
  Calendar, Users2, FileText, Receipt, CreditCard, MessageSquare,
  Bot, Smartphone, Trash2, Gift, Star, MapPin, Camera, CheckCircle,
  ArrowRight, Menu, X, ChevronRight,
} from "lucide-react";

// ─── Public marketing / landing page for CrewBoss (this product) ──────────────
// Reached at "#/" (or "#/welcome") for any visitor with no active session —
// see App.tsx's page-resolution useState and the "welcome" gate just above
// the login screen. Purely presentational + a "Get Started" / "Log In" CTA
// that hands off to the existing login screen (App.tsx sets page to "login").
// No Supabase reads/writes here at all — this must render instantly for an
// anonymous visitor with zero network round trips.
//
// Visual language deliberately mirrors the rest of the app (see
// useGlobalStyles.ts / ClientAuthPortal.tsx / Dashboard.tsx): bg-black,
// red gradient accents, .glass cards, animate-fade-in. Scroll-reveal and
// hover motion are done with plain CSS (IntersectionObserver-driven class
// toggle + Tailwind transitions) — no animation library added.

// ─── Scroll-reveal wrapper ─────────────────────────────────────────────────
// Adds "is-visible" once the element crosses into the viewport, which the
// <style> block below turns into a fade+slide-up transition. Falls back to
// already-visible if IntersectionObserver isn't available (very old
// browsers / SSR-safety) rather than leaving content invisible.
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
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

// ─── Feature data ───────────────────────────────────────────────────────────
// Pulled from real, working features in this codebase — not aspirational
// copy. See CLAUDE.md "Working features" + Key files for the source of each.
const FEATURES: Array<{ icon: React.ElementType; title: string; desc: string }> = [
  {
    icon: Calendar,
    title: "Scheduling & Crew Assignment",
    desc: "Drag jobs onto the calendar, assign crew members, and track every job from Unscheduled to Done — synced live to the field.",
  },
  {
    icon: FileText,
    title: "Estimates, Invoices & Payments",
    desc: "Send branded estimates customers can review and e-sign online, convert them straight to invoices, and get paid — including charging a card in person on-site.",
  },
  {
    icon: CreditCard,
    title: "Stripe Payment Processing",
    desc: "Take deposits, full payments, or in-person card charges through a direct Stripe integration — no third-party payment app required.",
  },
  {
    icon: Users2,
    title: "Client Portal",
    desc: "Every customer gets their own secure portal to view job history, sign estimates, and pay invoices — no account juggling on your end.",
  },
  {
    icon: MessageSquare,
    title: "Automated SMS & Email Follow-Ups",
    desc: "On-the-way texts, running-late alerts, review requests, and campaign blasts go out automatically by SMS or the owner's own Gmail — never a generic \"noreply\" address.",
  },
  {
    icon: Bot,
    title: "Alfred, Your AI Assistant",
    desc: "An AI assistant that can actually act on your CRM — schedule jobs, pull reports, answer questions — from the app or straight from a text message.",
  },
  {
    icon: Smartphone,
    title: "Mobile Field Portal",
    desc: "Crew members clock in/out, follow pre/during/post-job checklists, snap photos on-site, and share GPS location — all from their phone.",
  },
  {
    icon: Trash2,
    title: "Trash Can Route Management",
    desc: "Run a recurring trash-can cleaning route alongside pressure washing, with its own signup flow and schedule.",
  },
  {
    icon: Gift,
    title: "Referral Program",
    desc: "Turn happy customers into new leads with a built-in referral link and reward tracking.",
  },
  {
    icon: Star,
    title: "Review Requests",
    desc: "Automatically ask satisfied customers for a Google review right after the job's done, while it's fresh.",
  },
  {
    icon: MapPin,
    title: "Live Crew Tracking",
    desc: "See who's on shift, where they are, and how far along their checklist is — updated every few seconds on the owner dashboard.",
  },
  {
    icon: Camera,
    title: "Job Photo Documentation",
    desc: "Before/after photos attached directly to the job record, visible to the office and the customer alike.",
  },
];

// ─── Pricing (illustrative) ──────────────────────────────────────────────────
// NOTE: this app's data model has no real plan/tier/subscription/billing
// concept (checked src/types/index.ts and App.tsx) — these three tiers are
// clean, reasonable placeholder pricing for a small-business CRM, clearly
// marked as such below, and are NOT wired to any real payment/signup flow.
const PLANS: Array<{ name: string; price: string; period: string; tagline: string; features: string[]; highlighted?: boolean }> = [
  {
    name: "Solo",
    price: "$49",
    period: "/mo",
    tagline: "For an owner-operator running the show alone.",
    features: [
      "Unlimited jobs & customers",
      "Estimates, invoices & Stripe payments",
      "Client portal",
      "SMS & email follow-ups",
      "1 user seat",
    ],
  },
  {
    name: "Crew",
    price: "$99",
    period: "/mo",
    tagline: "For a business running an actual crew in the field.",
    features: [
      "Everything in Solo",
      "Unlimited crew/employee seats",
      "Mobile field portal (GPS, checklists, photos)",
      "Live crew tracking dashboard",
      "Alfred AI assistant",
      "Referral & review automation",
    ],
    highlighted: true,
  },
  {
    name: "Growth",
    price: "$199",
    period: "/mo",
    tagline: "For multi-crew operations that want it all automated.",
    features: [
      "Everything in Crew",
      "Trash-can route management",
      "Campaign blasts & segment targeting",
      "Priority support",
      "Custom onboarding",
    ],
  },
];

export function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* ── Scoped styles: scroll-reveal + gradient blob motion ────────────── */}
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

      {/* ── Background gradient blobs ───────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="lp-blob absolute -top-32 -left-24 w-96 h-96 rounded-full bg-red-700/20 blur-3xl" />
        <div className="lp-blob-slow absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-red-900/25 blur-3xl" />
        <div className="lp-blob absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-red-800/15 blur-3xl" />
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-black/60 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-900/40">
              <span className="text-white font-black text-sm">CB</span>
            </div>
            <span className="font-bold text-lg tracking-tight">Crew<span className="text-red-500">Boss</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <button
              onClick={onGetStarted}
              className="text-white/70 hover:text-white transition-colors"
            >
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
            <a href="#features" onClick={() => setNavOpen(false)} className="block py-2 text-white/70">Features</a>
            <a href="#pricing" onClick={() => setNavOpen(false)} className="block py-2 text-white/70">Pricing</a>
            <button onClick={onGetStarted} className="w-full text-left py-2 text-white/70">Log In</button>
            <button
              onClick={onGetStarted}
              className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-br from-red-600 to-red-800 font-semibold"
            >
              Start Free Trial
            </button>
          </div>
        )}
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative px-4 md:px-6 pt-16 pb-20 md:pt-28 md:pb-32 max-w-5xl mx-auto text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-red-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-ring" />
            Built for pressure-washing crews
          </div>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Run your entire<br className="hidden sm:block" /> <span className="lp-hero-gradient">wash business</span><br className="hidden sm:block" /> from one screen.
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="text-base md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Scheduling, estimates, invoicing, payments, crew tracking, and an AI assistant that texts your customers for you —
            CrewBoss is the CRM built specifically for pressure-washing businesses, not adapted from something else.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="group w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 font-bold text-base shadow-xl shadow-red-900/40 hover:shadow-red-700/50 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              Start Free Trial
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl glass hover:bg-white/[0.06] font-semibold text-base transition-all"
            >
              Log In
            </button>
          </div>
          <p className="text-xs text-white/30 mt-4">No credit card required to explore. Cancel anytime.</p>
        </Reveal>
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────────────── */}
      <section id="features" className="px-4 md:px-6 py-16 md:py-24 max-w-6xl mx-auto">
        <Reveal className="text-center mb-12 md:mb-16">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            Everything the office <span className="gradient-text">and</span> the field need
          </h2>
          <p className="text-white/50 max-w-xl mx-auto text-sm md:text-base">
            One system, from the first estimate to the paid invoice.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 90}>
              <div className="lp-card-hover glass p-5 md:p-6 h-full">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600/20 to-red-900/20 border border-red-700/30 flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-red-400" />
                </div>
                <h3 className="font-bold text-white mb-1.5 text-sm md:text-base">{f.title}</h3>
                <p className="text-white/50 text-xs md:text-sm leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Social-proof style strip ─────────────────────────────────────────── */}
      <Reveal className="px-4 md:px-6">
        <section className="max-w-5xl mx-auto glass p-6 md:p-10 flex flex-col md:flex-row items-center justify-around gap-8 text-center mb-8">
          {[
            { stat: "3s", label: "Live crew status refresh" },
            { stat: "24/7", label: "Alfred AI, on call by text" },
            { stat: "1", label: "screen for the whole business" },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl md:text-4xl font-black gradient-text">{s.stat}</div>
              <div className="text-white/50 text-xs md:text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </section>
      </Reveal>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-4 md:px-6 py-16 md:py-24 max-w-6xl mx-auto">
        <Reveal className="text-center mb-12 md:mb-16">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            Simple, <span className="gradient-text">honest</span> pricing
          </h2>
          <p className="text-white/50 max-w-xl mx-auto text-sm md:text-base">
            Pick the plan that matches your crew size. Switch anytime.
          </p>
          <p className="text-white/25 text-[11px] mt-2">Illustrative pricing — contact us for current rates.</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-stretch">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 100}>
              <div
                className={
                  "lp-card-hover h-full flex flex-col p-6 md:p-7 rounded-2xl border relative overflow-hidden " +
                  (plan.highlighted
                    ? "bg-gradient-to-b from-red-950/60 to-black border-red-600/60 shadow-xl shadow-red-900/30 md:-translate-y-2"
                    : "glass")
                }
              >
                {plan.highlighted && (
                  <div className="absolute top-0 right-0 bg-gradient-to-br from-red-600 to-red-800 text-[10px] font-bold px-3 py-1 rounded-bl-lg tracking-wide">
                    MOST POPULAR
                  </div>
                )}
                <div className="text-sm font-semibold text-white/70 mb-1">{plan.name}</div>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-3xl md:text-4xl font-black">{plan.price}</span>
                  <span className="text-white/40 text-sm mb-1">{plan.period}</span>
                </div>
                <p className="text-white/45 text-xs md:text-sm mb-6">{plan.tagline}</p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2 text-xs md:text-sm text-white/70">
                      <CheckCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={onGetStarted}
                  className={
                    "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-1.5 " +
                    (plan.highlighted
                      ? "bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 shadow-lg shadow-red-900/30 hover:-translate-y-0.5"
                      : "bg-white/5 hover:bg-white/10 border border-white/10")
                  }
                >
                  Get Started
                  <ChevronRight size={15} />
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <Reveal className="px-4 md:px-6">
        <section className="max-w-4xl mx-auto text-center py-16 md:py-20">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-4">
            Ready to run a tighter crew?
          </h2>
          <p className="text-white/50 mb-8 text-sm md:text-base max-w-xl mx-auto">
            Set up your business in minutes. No spreadsheets, no sticky notes, no more "who's on that job right now."
          </p>
          <button
            onClick={onGetStarted}
            className="group px-8 py-3.5 rounded-xl bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 font-bold text-base shadow-xl shadow-red-900/40 hover:shadow-red-700/50 transition-all hover:-translate-y-0.5 inline-flex items-center gap-2"
          >
            Start Free Trial
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>
        </section>
      </Reveal>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 px-4 md:px-6 py-10 mt-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center">
              <span className="text-white font-black text-[10px]">CB</span>
            </div>
            <span className="font-bold text-sm tracking-tight text-white/70">Crew<span className="text-red-500">Boss</span></span>
          </div>

          <div className="flex items-center gap-6 text-xs text-white/40">
            <a href="#/terms" className="hover:text-white/70 transition-colors">Terms</a>
            <a href="#/privacy" className="hover:text-white/70 transition-colors">Privacy</a>
            <button onClick={onGetStarted} className="hover:text-white/70 transition-colors">Log In</button>
          </div>

          <div className="text-[11px] text-white/25">
            © {new Date().getFullYear()} CrewBoss. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
