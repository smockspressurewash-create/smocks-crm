import React from "react";
import {
  Calendar, Users2, FileText, CreditCard, MessageSquare,
  Bot, Smartphone, Trash2, Gift, Star, MapPin, Camera, CheckCircle,
  ArrowRight, ChevronRight,
} from "lucide-react";
import {
  Reveal, MarketingStyles, BackgroundBlobs, MarketingNav, MarketingFooter,
  MarketingPage,
} from "./MarketingShared";

// ─── Public marketing / landing page for CrewBoss (this product) ──────────────
// Reached at "#/" (or "#/welcome") for any visitor with no active session —
// see App.tsx's page-resolution useState and the "welcome" gate just above
// the login screen. Purely presentational + a "Get Started" / "Log In" CTA
// that hands off to the existing login screen (App.tsx sets page to "login"),
// plus real cross-page navigation (onNavigate) to the dedicated
// #/features, #/pricing, and #/about pages — see MarketingShared.tsx for the
// shared nav/footer/Reveal/background treatment every marketing page uses.
// No Supabase reads/writes here at all — this must render instantly for an
// anonymous visitor with zero network round trips.
//
// Visual language deliberately mirrors the rest of the app (see
// useGlobalStyles.ts / ClientAuthPortal.tsx / Dashboard.tsx): bg-black,
// red gradient accents, .glass cards, animate-fade-in. Scroll-reveal and
// hover motion are done with plain CSS (IntersectionObserver-driven class
// toggle + Tailwind transitions) — no animation library added.

// ─── Feature data (condensed teaser grid — see FeaturesPage.tsx for the full,
// categorized breakdown of the same real, working features) ────────────────
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
export const PLANS: Array<{ name: string; price: string; period: string; tagline: string; features: string[]; highlighted?: boolean }> = [
  {
    name: "Solo",
    price: "$39",
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
    price: "$79",
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
    price: "$149",
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

export function LandingPage({
  onGetStarted,
  onNavigate,
}: {
  onGetStarted: () => void;
  onNavigate: (page: MarketingPage) => void;
}) {
  return (
    // BUG FIX — index.css locks html/body/#root to a hard 100% height with
    // overflow:hidden (this app's whole architecture is "only specific
    // internal panes scroll," never the page itself — see index.css's own
    // comment). A marketing page assuming normal page/body scroll (just
    // min-h-screen, no overflow of its own) had literally nowhere for a
    // scroll to happen once its content exceeded one viewport — this div
    // must BE the scrolling pane itself, same as every other page's <main>.
    <div className="h-dvh h-screen overflow-y-auto bg-black text-white overflow-x-hidden">
      <MarketingStyles />
      <BackgroundBlobs />
      <MarketingNav active="welcome" onNavigate={onNavigate} onGetStarted={onGetStarted} />

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

      {/* ── Feature grid (teaser — full breakdown on #/features) ────────────── */}
      <section className="px-4 md:px-6 py-16 md:py-24 max-w-6xl mx-auto">
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

        <Reveal className="text-center mt-10">
          <button
            onClick={() => onNavigate("features")}
            className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 font-semibold text-sm transition-colors"
          >
            See the full feature breakdown
            <ChevronRight size={16} />
          </button>
        </Reveal>
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

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-16 md:py-24 max-w-5xl mx-auto">
        <Reveal className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-5xl font-black mb-3">Up and running the same day</h2>
          <p className="text-white/50 max-w-xl mx-auto">No onboarding calls, no waiting on a sales rep — set up your business and start sending real estimates within the hour.</p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {[
            { step: "1", title: "Set up your business", desc: "Add your company info, services, and pricing. Connect Stripe and Twilio when you're ready — everything works without them too, you can turn features on as you grow." },
            { step: "2", title: "Send your first estimate", desc: "Build a branded estimate in minutes, text or email it to the customer, and watch it get signed and paid without a single phone call." },
            { step: "3", title: "Your crew clocks in", desc: "Assign the job, and your crew sees it on their phone — checklists, directions, and a Clock In button. You see exactly where they are and how it's going." },
          ].map((s, i) => (
            <Reveal key={s.step} delay={i * 100}>
              <div className="glass p-6 md:p-8 h-full">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-black text-lg mb-4">{s.step}</div>
                <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Built for the field, not a desk ──────────────────────────────────── */}
      <Reveal className="px-4 md:px-6">
        <section className="max-w-6xl mx-auto py-16 md:py-24 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-black mb-4">Built for the field, not a desk</h2>
            <p className="text-white/50 leading-relaxed mb-6">
              Most CRMs are built for someone sitting at a computer all day. CrewBoss assumes your crew is standing in a driveway with soaked boots and one hand full of hose — every field-facing screen is designed to be usable one-thumbed, in bright sunlight, with spotty signal.
            </p>
            <ul className="space-y-3">
              {[
                "Install it like a real app on any phone — no App Store required",
                "Checklists, photos, and clock in/out survive a weak connection",
                "GPS location shared only while a shift is active, never tracked after hours",
                "Works the same whether it's one truck or five crews running at once",
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                  <CheckCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass p-6 md:p-10 text-center">
            <div className="text-5xl md:text-6xl font-black gradient-text mb-3">📱</div>
            <div className="font-bold text-lg mb-2">One app, every role</div>
            <p className="text-white/50 text-sm leading-relaxed">Owners get the full CRM. Crew get a lightweight field portal built just for the job in front of them. Customers get their own portal to sign, pay, and track their service — nobody logs into the wrong thing.</p>
          </div>
        </section>
      </Reveal>

      {/* ── Pricing (teaser — full comparison on #/pricing) ─────────────────── */}
      <section className="px-4 md:px-6 py-16 md:py-24 max-w-6xl mx-auto">
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

        <Reveal className="text-center mt-10">
          <button
            onClick={() => onNavigate("pricing")}
            className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 font-semibold text-sm transition-colors"
          >
            See full plan comparison & FAQ
            <ChevronRight size={16} />
          </button>
        </Reveal>
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

      <MarketingFooter onNavigate={onNavigate} onGetStarted={onGetStarted} />
    </div>
  );
}
