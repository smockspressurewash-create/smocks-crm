import React, { useState } from "react";
import { Star, CheckCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uid, today } from "../../lib/utils";

// Public-facing customer review page — no auth required.
// URL: #/rate?c=CUSTOMER_ID&n=CUSTOMER_FIRST_NAME&g=GOOGLE_PLACE_ID&co=COMPANY_NAME
// 4–5 stars → redirects to Google Maps review.
// 1–3 stars → private feedback form saved to Supabase reviews table.

function hashParam(key: string): string {
  const hash = window.location.hash;
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get(key) || "";
}

export function CustomerReviewPage() {
  const customerId = hashParam("c");
  const firstName = decodeURIComponent(hashParam("n") || "there");
  const googlePlaceId = hashParam("g");
  const companyName = decodeURIComponent(hashParam("co") || "Crew Boss");

  const googleUrl = googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
    : "https://g.page/r/smocks-pressure-washing/review";

  const [step, setStep] = useState<"rate" | "happy" | "unhappy" | "done">("rate");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const saveToSupabase = async (r: number, text: string, status: "pending" | "private") => {
    try {
      await (supabase as any).from("reviews").insert({
        id: uid(),
        customerId: customerId || "unknown",
        customerName: firstName,
        rating: r,
        text,
        createdAt: today(),
        source: "sms-request",
        status,
      });
    } catch { /* reviews table may not exist yet */ }
  };

  const pick = (r: number) => {
    setRating(r);
    setTimeout(() => setStep(r >= 4 ? "happy" : "unhappy"), 300);
  };

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    await saveToSupabase(rating, feedback.trim(), "private");
    setSubmitting(false);
    setStep("done");
  };

  const stars = (n: number) => Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      size={n}
      className={"transition-colors " + (i < (hover || rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20")}
    />
  ));

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-8">
      {/* Brand header */}
      <div className="w-full max-w-sm">
        <div className="bg-gradient-to-br from-red-700 to-red-900 rounded-2xl p-6 text-center mb-6 shadow-2xl shadow-red-900/40">
          <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🚿</span>
          </div>
          <div className="font-black text-xl text-white">{companyName}</div>
          <div className="text-red-200 text-xs mt-1">York, PA</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          {step === "rate" && (
            <div className="text-center space-y-6">
              <div>
                <div className="text-2xl font-bold">Hi {firstName}! 👋</div>
                <div className="text-white/60 mt-2">How was your recent pressure washing service?</div>
              </div>
              <div className="flex justify-center gap-2 py-2"
                onMouseLeave={() => setHover(0)}>
                {[1,2,3,4,5].map(s => (
                  <button
                    key={s}
                    onMouseEnter={() => setHover(s)}
                    onTouchStart={() => setHover(s)}
                    onClick={() => pick(s)}
                    className="transition-all hover:scale-125 active:scale-95"
                  >
                    <Star
                      size={48}
                      className={"transition-colors " + (s <= (hover || rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20")}
                    />
                  </button>
                ))}
              </div>
              <div className="text-sm text-white/40">
                {hover === 1 ? "Terrible" : hover === 2 ? "Poor" : hover === 3 ? "Okay" : hover === 4 ? "Good" : hover === 5 ? "Excellent! 🌟" : "Tap a star to rate"}
              </div>
            </div>
          )}

          {step === "happy" && (
            <div className="text-center space-y-5">
              <div className="text-5xl">🎉</div>
              <div>
                <div className="text-xl font-bold text-yellow-400">Awesome — thank you!</div>
                <div className="text-white/60 text-sm mt-1">Your {rating}-star experience means the world to us. Would you share it on Google? It helps other homeowners find us.</div>
              </div>
              <div className="flex justify-center gap-1">{stars(22)}</div>
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { saveToSupabase(rating, "", "pending"); setTimeout(() => setStep("done"), 600); }}
                className="flex items-center justify-center gap-2 w-full py-4 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition text-base"
              >
                <img src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" alt="G" className="w-5 h-5" />
                Leave a Google Review
              </a>
              <button
                onClick={() => { saveToSupabase(rating, "declined-google", "pending"); setStep("done"); }}
                className="text-xs text-white/30 hover:text-white/60 transition"
              >
                Maybe later
              </button>
            </div>
          )}

          {step === "unhappy" && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-4xl">😔</div>
                <div className="text-xl font-bold mt-2">We're sorry to hear that</div>
                <div className="text-white/60 text-sm mt-1">Please tell us what went wrong — we want to make it right.</div>
              </div>
              <div className="flex justify-center gap-1">{stars(20)}</div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block uppercase tracking-wider">Your feedback (private — only we see this)</label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={4}
                  placeholder="What could we have done better?"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-red-500/50"
                />
              </div>
              <button
                onClick={submitFeedback}
                disabled={!feedback.trim() || submitting}
                className="w-full py-3.5 bg-gradient-to-r from-red-700 to-red-900 border border-red-600/50 text-white font-bold rounded-xl transition disabled:opacity-40"
              >
                {submitting ? "Sending…" : "Send Private Feedback"}
              </button>
              <button onClick={() => setStep("rate")} className="text-xs text-white/30 hover:text-white/60 w-full text-center transition">← Change my rating</button>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-4 space-y-4">
              <CheckCircle size={52} className="mx-auto text-green-400" />
              <div className="text-xl font-bold">{rating >= 4 ? "Thank you! ⭐" : "We appreciate your honesty"}</div>
              <div className="text-white/60 text-sm">
                {rating >= 4
                  ? "Your review helps homeowners in York find great service."
                  : "We'll be in touch to make this right. We really do care."}
              </div>
              <div className="pt-2 text-xs text-white/30">— {companyName}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
