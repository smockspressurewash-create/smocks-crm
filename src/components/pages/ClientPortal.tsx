// auto-extracted from Smock's OS monolith
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard, Users, FileText, Briefcase, Bot, BarChart3,
  Settings, Bell, Menu, X, Plus, Search, Edit, Trash2, Send,
  DollarSign, TrendingUp, CheckCircle, Clock, MapPin, Phone, Mail,
  Calendar, AlertTriangle, Truck, Receipt, FlaskConical, MessageSquare,
  Sun, Moon, Download, Undo2, Redo2, Volume2, Play, Cloud, Star,
  Award, Target, Shield, Key, Eye, EyeOff, Save, ChevronRight,
  ChevronLeft, GripVertical, Tag, Copy, Ban, RefreshCw, Percent,
  CreditCard, Repeat, XCircle, Activity, Zap, UserCheck, AlertCircle,
  Clipboard, Heart, Dumbbell, Droplet, Smile, Flame, Wind, Snowflake,
  Globe, Share2, Trophy, ExternalLink, Workflow, ToggleLeft, ToggleRight,
  Navigation, TrendingDown, PieChart as PieIcon, Package, Wrench,
  CheckSquare, Route, Users2, Layers, ArrowRight, BarChart2, Filter,
  Paperclip, ImageIcon, FileImage, MoreVertical, Mic, Upload, Link, Lock, User
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, LineChart, Line,
  ComposedChart, Legend
} from "recharts";
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GSel } from "../ui/GSel";
import { GTxt } from "../ui/GTxt";
import { Modal } from "../ui/Modal";
import { StripePaymentModal } from "../ui/StripePaymentModal";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { PBar } from "../ui/PBar";
import { PageFade } from "../ui/PageFade";
import { TimeframeSelector } from "../ui/TimeframeSelector";
import { AddressAutocomplete } from "../ui/AddressAutocomplete";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { CustomerModal } from "../ui/CustomerModal";
import { CustomerDetail } from "../ui/CustomerDetail";
import { CustomerAnalytics } from "../ui/CustomerAnalytics";
import { EstimateBuilder } from "../ui/EstimateBuilder";
import { EstimatePreview } from "../ui/EstimatePreview";
import { JobDetailModal } from "../ui/JobDetailModal";
import { PipelineScrollContainer } from "../ui/PipelineScrollContainer";
import { SwipeableCard } from "../ui/SwipeableCard";
import { ReviewMonitor } from "../ui/ReviewMonitor";
import { ReviewLandingPage } from "../ui/ReviewLandingPage";
import { ReviewPreview } from "../ui/ReviewPreview";
import { VisualWorkflowBuilder } from "../ui/VisualWorkflowBuilder";
import { AutomationEditor } from "../ui/AutomationEditor";
import { VoiceMicButton } from "../ui/VoiceMicButton";
import { DocumentVault } from "../ui/DocumentVault";
import { ESignatureStep } from "../ui/ESignatureStep";
import { ChemicalCostCalc } from "../ui/ChemicalCostCalc";
import { CACCalculator } from "../ui/CACCalculator";
import { MileageUpdateModal } from "../ui/MileageUpdateModal";
import { VehicleModal } from "../ui/VehicleModal";
import { MaintenanceModal } from "../ui/MaintenanceModal";
import { SocialCalendar } from "../ui/SocialCalendar";
import { BulkPhotoUpload } from "../ui/BulkPhotoUpload";
import { ReviewToGraphic } from "../ui/ReviewToGraphic";
import { ABTestPanel } from "../ui/ABTestPanel";
import { CampaignScheduler } from "../ui/CampaignScheduler";
import { PinSettings } from "../ui/PinSettings";
import { ServiceCatalogSection } from "../ui/ServiceCatalogSection";
import { TemplateEditor } from "../ui/TemplateEditor";
import { AIModelsSection } from "../ui/AIModelsSection";
import { ChemicalModal } from "../ui/ChemicalModal";
import { WeeklyBusinessReview } from "../ui/WeeklyBusinessReview";
import { WeeklyReflectionTab } from "../ui/WeeklyReflectionTab";

export function ClientPortal({ estimate: e, customer: c, settings = {} as AppSettings, onClose, onApprove }: { estimate?: any; customer?: any; settings?: AppSettings; onClose?: any; onApprove?: any }) {
  const [payType, setPayType] = useState("full");
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [step, setStep] = useState("view"); // view | sign | payment | done
  const [sigData, setSigData] = useState(null);
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState("");
  // Options type — toggleable items
  const [enabledItems, setEnabledItems] = useState<Record<string, boolean>>({});
  // Package type — selected package
  const [selectedPkgId, setSelectedPkgId] = useState<string>("");
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  // Initialize options/package state when estimate is available
  useEffect(() => {
    if (!e) return;
    if (e.estimateType === "options") {
      const init: Record<string, boolean> = {};
      (e.lineItems || []).forEach((li: any) => { init[li.id] = !li.optional; });
      setEnabledItems(init);
    }
    if (e.estimateType === "package" && e.packages?.length) {
      setSelectedPkgId(e.packages[0].id);
    }
  }, [e?.id]);

  // Compute effective total based on type
  const effectiveLineItems = e?.estimateType === "options"
    ? (e.lineItems || []).filter((li: any) => enabledItems[li.id] !== false)
    : (e.lineItems || []);
  const effectivePkg = e?.estimateType === "package"
    ? (e.packages || []).find((p: any) => p.id === selectedPkgId)
    : null;
  const effectiveTotal = e?.estimateType === "package"
    ? (effectivePkg?.subtotal || 0)
    : e?.estimateType === "options"
    ? effectiveLineItems.reduce((s: number, li: any) => s + Number(li.quantity) * Number(li.unitPrice), 0)
    : (e?.total || 0);

  const depositAmt = e ? (e.depositRequired || Math.round(effectiveTotal * 0.25)) : 0;
  const payAmt = payType === "deposit" ? depositAmt : effectiveTotal;
  const totalWithTip = payAmt + tip;

  // Notify Will when estimate is first viewed
  useEffect(() => {
    if (!e?.id) return;
    const key = "smocks.estimateViewed." + e.id;
    if (sessionStorage.getItem(key)) return; // only fire once per session
    sessionStorage.setItem(key, "1");
    if (settings?.twilioSid && settings?.myPhone && c) {
      const msg = "👀 ESTIMATE VIEWED\n\n" + c.firstName + " " + c.lastName + " just opened their estimate for " + fmt(e.total) + ".\n\nNow's a great time to follow up if they don't sign in 30 min. — Alfred";
      twilioSend(settings, settings.myPhone, msg).catch(() => {});
    }
  }, [e?.id]); // eslint-disable-line

  if (!e || !c) return null;

  // Signature canvas setup
  useEffect(() => {
    if (step !== "sign") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [step]);

  const getPos = (canvas, e) => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const startDraw = e => {
    drawing.current = true;
    lastPos.current = getPos(canvasRef.current, e);
  };

  const draw = e => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => {
    drawing.current = false;
    setSigData(canvasRef.current.toDataURL());
  };

  const clearSig = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigData(null);
  };

  const handleApprove = async (paymentIntentId?: string) => {
    if (onApprove) onApprove(e.id, {
      sigData, payType, tip, totalPaid: totalWithTip, signedAt: new Date().toISOString(),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" as const } : {}),
    });
    setStep("done");

    // Payment confirmation SMS to customer
    if (settings?.twilioSid && c.phone) {
      const confirmMsg = "Hi " + c.firstName + "! Your payment of $" + totalWithTip.toFixed(2) + " to Smock's Pressure Washing has been received ✅ We'll be in touch to confirm your service date. Thank you! — " + (settings?.companyName || "Smock's");
      twilioSend(settings, c.phone, confirmMsg).catch(() => {});
    }

    // Payment confirmation email to customer
    if (c.email && (settings?.resendKey || settings?.googleConnected)) {
      const subject = "Payment Receipt — Smock's Pressure Washing";
      const body = "Hi " + c.firstName + ",\n\nThank you for your payment of $" + totalWithTip.toFixed(2) + ".\n\nServices: " + (e.lineItems || []).map(li => li.description).join(", ") + "\nAmount: $" + totalWithTip.toFixed(2) + "\n\nWe'll contact you soon to schedule your service.\n\n— " + (settings?.companyName || "Smock's Pressure Washing") + "\n" + (settings?.companyPhone || "(717) 555-0100");
      sendEmail(settings, { to: c.email, subject, body }).catch(() => {});
    }

    // Notify Will via SMS about the new payment
    if (settings?.twilioSid && settings?.myPhone) {
      const ownerMsg = "💰 PAYMENT RECEIVED: " + c.firstName + " " + c.lastName + " paid $" + totalWithTip.toFixed(2) + (tip > 0 ? " (incl. $" + tip.toFixed(2) + " tip)" : "") + " — " + (e.lineItems?.[0]?.description || "service");
      twilioSend(settings, settings.myPhone, ownerMsg).catch(() => {});
    }
  };

  const companyName = settings?.companyName || "Smock's Pressure Washing";
  const companyPhone = settings?.companyPhone || "(717) 555-0100";

  return (
    <Modal open={!!e} onClose={onClose} title="" maxW="max-w-2xl">
      <div className="-mx-5 -mt-5">
        {/* Portal header */}
        <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-lg">{companyName}</div>
              <div className="text-red-200 text-xs">{companyPhone} · York, PA</div>
            </div>
            <div className="text-right text-white/80 text-xs">
              <div className="font-bold text-sm">ESTIMATE</div>
              <div>#{e.id.toUpperCase()}</div>
              <div>Valid until {e.validUntil}</div>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-6 py-3 bg-black/20 border-b border-red-900/20 gap-2">
          {["view","sign","payment","done"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={"w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all " + (step === s ? "bg-red-600 text-white" : ["done","payment","sign","view"].indexOf(step) < ["done","payment","sign","view"].indexOf(s) ? "bg-white/10 text-white/40" : "bg-green-600/40 text-green-300")}>
                {i + 1}
              </div>
              <span className={"text-[10px] capitalize hidden sm:block " + (step === s ? "text-white font-medium" : "text-white/40")}>{s === "view" ? "Review" : s === "sign" ? "Sign" : s === "payment" ? "Payment" : "Done"}</span>
              {i < 3 && <ChevronRight size={12} className="text-white/20" />}
            </div>
          ))}
        </div>

        <div className="p-6">
          {/* STEP 1: Review */}
          {step === "view" && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Bill To</div>
                <div className="font-semibold text-lg">Hi {c.firstName} 👋</div>
                <div className="text-white/60 text-sm">{c.address}</div>
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-2">
                  {e.estimateType === "package" ? "Choose Your Package" : e.estimateType === "options" ? "Services — Select What You Need" : "Services"}
                </div>

                {/* PACKAGE type — radio buttons per package */}
                {e.estimateType === "package" && (e.packages || []).map((pkg: any) => (
                  <div key={pkg.id} onClick={() => setSelectedPkgId(pkg.id)} className={"mb-2 p-3 rounded-xl border-2 cursor-pointer transition " + (selectedPkgId === pkg.id ? "border-red-500 bg-red-950/20" : "border-white/10 bg-black/40 hover:border-white/20")}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={"w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 " + (selectedPkgId === pkg.id ? "border-red-500" : "border-white/30")}>
                          {selectedPkgId === pkg.id && <div className="w-2 h-2 rounded-full bg-red-500" />}
                        </div>
                        <div className="font-semibold text-sm">{pkg.name}</div>
                      </div>
                      <div className="font-bold text-red-400 text-sm">{fmt(pkg.subtotal || 0)}</div>
                    </div>
                    {pkg.description && <div className="text-xs text-white/50 ml-6 mb-1">{pkg.description}</div>}
                    <div className="ml-6 space-y-0.5">
                      {(pkg.lineItems || []).map((li: any) => <div key={li.id} className="text-xs text-white/60 flex justify-between"><span>· {li.description}</span><span>{fmt(li.quantity * li.unitPrice)}</span></div>)}
                    </div>
                  </div>
                ))}

                {/* OPTIONS type — checkboxes */}
                {e.estimateType === "options" && (
                  <div className="space-y-2">
                    {(e.lineItems || []).map((li: any) => {
                      const enabled = enabledItems[li.id] !== false;
                      return (
                        <div key={li.id} onClick={() => li.optional && setEnabledItems(p => ({ ...p, [li.id]: !enabled }))} className={"p-3 rounded-xl border transition " + (li.optional ? "cursor-pointer " : "") + (enabled ? "bg-black/40 border-red-900/20" : "bg-black/20 border-white/5 opacity-60")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              {li.optional ? (
                                <div className={"w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 " + (enabled ? "border-red-500 bg-red-500" : "border-white/30")}>
                                  {enabled && <CheckCircle size={10} className="text-white" />}
                                </div>
                              ) : <div className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{li.description}</div>
                                {li.optional && <div className="text-[10px] text-blue-400/70 mt-0.5">Optional — tap to toggle</div>}
                                {li.notes && !li.notesInternal && <div className="text-xs text-white/60 mt-1 italic">{li.notes}</div>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {li.photo && <img src={li.photo} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10" />}
                              <div className={"font-bold text-sm " + (enabled ? "text-red-400" : "text-white/30")}>{fmt(li.quantity * li.unitPrice)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-xs text-white/40 text-right">Running total: <span className="text-white font-semibold">{fmt(effectiveTotal)}</span></div>
                  </div>
                )}

                {/* STANDARD type — original display */}
                {(!e.estimateType || e.estimateType === "standard") && (
                  <div className="space-y-2">
                    {(e.lineItems || []).map((li: any) => (
                      <div key={li.id} className="p-3 bg-black/40 border border-red-900/20 rounded-xl">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{li.description}</div>
                            {li.quantity > 1 && <div className="text-xs text-white/50">× {li.quantity}</div>}
                            {li.notes && !li.notesInternal && <div className="text-xs text-white/60 mt-1 italic">{li.notes}</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {li.photo && <img src={li.photo} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10" />}
                            <div className="font-bold text-red-400">{fmt(li.quantity * li.unitPrice)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Glass className="p-4 !bg-black/60">
                <div className="space-y-1 text-sm">
                  {(!e.estimateType || e.estimateType === "standard") && <>
                    <div className="flex justify-between text-white/70"><span>Subtotal</span><span>{fmt(e.subtotal)}</span></div>
                    {e.discount > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><span>− {fmt(e.discount)}</span></div>}
                    <div className="flex justify-between text-white/70"><span>Tax</span><span>{fmt(e.tax)}</span></div>
                  </>}
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-red-900/30"><span>Total</span><span className="text-red-400 text-xl">{fmt(effectiveTotal)}</span></div>
                </div>
              </Glass>
              {e.notes && <Glass className="p-3 !bg-blue-950/20 !border-blue-700/30"><div className="text-xs text-white/60 mb-1">Notes</div><div className="text-sm">{e.notes}</div></Glass>}
              {e.terms && <div className="text-[10px] text-white/40 leading-relaxed">{e.terms}</div>}
              <GBtn onClick={() => setStep("sign")} className="w-full !py-3 text-base font-bold">
                Review & Sign →
              </GBtn>
            </div>
          )}

          {/* STEP 2: Signature */}
          {step === "sign" && (
            <ESignatureStep
              e={e} c={c} sigData={sigData} setSigData={setSigData}
              canvasRef={canvasRef} startDraw={startDraw} draw={draw} stopDraw={stopDraw} clearSig={clearSig}
              onBack={() => setStep("view")} onNext={() => setStep("payment")}
            />
          )}

          {/* STEP 3: Payment */}
          {step === "payment" && (
            <div className="space-y-4">
              <div className="font-semibold">Payment Options</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: "deposit", l: "Pay Deposit", sub: fmt(depositAmt) + " now, remainder on completion" },
                  { k: "full", l: "Pay in Full", sub: fmt(e.total) + " — save time on service day" }
                ].map(o => (
                  <button key={o.k} onClick={() => setPayType(o.k)} className={"p-4 rounded-xl border-2 text-left transition-all " + (payType === o.k ? "border-red-500 bg-red-950/30" : "border-white/10 bg-black/40 hover:border-white/20")}>
                    <div className="font-semibold text-sm">{o.l}</div>
                    <div className="text-[10px] text-white/60 mt-1">{o.sub}</div>
                    {payType === o.k && <CheckCircle size={14} className="text-red-400 mt-2" />}
                  </button>
                ))}
              </div>

              {/* Tip */}
              <div>
                <div className="text-xs text-white/60 mb-2">Add a tip? (optional)</div>
                <div className="flex gap-2">
                  {[0, 0.10, 0.15, 0.20].map(pct => (
                    <button key={pct} onClick={() => { setTip(pct > 0 ? Math.round(payAmt * pct * 100) / 100 : 0); setCustomTip(""); }} className={"flex-1 py-2 rounded-xl text-xs border transition " + (tip === Math.round(payAmt * pct * 100) / 100 && (pct > 0 || customTip === "") ? "bg-green-900/40 border-green-500/50 text-green-200" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>
                      {pct === 0 ? "No tip" : (pct * 100).toFixed(0) + "% (" + fmt(Math.round(payAmt * pct * 100) / 100) + ")"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <GInput type="number" step="1" min="0" placeholder="Custom tip amount" value={customTip} onChange={e => { setCustomTip(e.target.value); setTip(Number(e.target.value) || 0); }} className="!text-sm flex-1" />
                </div>
              </div>

              <Glass className="p-4 !bg-black/60">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-white/70">Payment amount</span><span>{fmt(payAmt)}</span></div>
                  {tip > 0 && <div className="flex justify-between text-green-400"><span>Tip 🙏</span><span>+ {fmt(tip)}</span></div>}
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-red-900/30"><span>Total charged today</span><span className="text-red-400">{fmt(totalWithTip)}</span></div>
                </div>
              </Glass>

              {/* Stripe payment — real Payment Element if keys are configured, otherwise a connect prompt */}
              {settings?.stripePublishableKey && settings?.stripeSecretKeyEnc ? (
                <div className="space-y-2">
                  <button onClick={() => setShowStripeModal(true)} className="w-full py-4 bg-gradient-to-r from-[#635BFF] to-[#4F46E5] text-white font-bold rounded-xl shadow-lg hover:from-[#7C74FF] hover:to-[#6056F5] transition-all flex items-center justify-center gap-2">
                    <CreditCard size={18} />
                    Pay {fmt(totalWithTip)} · Powered by Stripe
                  </button>
                  <div className="text-center text-[10px] text-white/30">🔒 Your payment is secured by Stripe · 256-bit SSL</div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center space-y-2">
                  <CreditCard size={20} className="mx-auto text-white/30" />
                  <div className="text-sm text-white/60">Online payments aren't set up yet.</div>
                  <div className="text-xs text-white/40">{companyName} hasn't connected Stripe — contact us directly to arrange payment.</div>
                </div>
              )}
              <GBtn variant="ghost" onClick={() => setStep("sign")} className="w-full">← Back to signature</GBtn>

              <StripePaymentModal
                open={showStripeModal}
                onClose={() => setShowStripeModal(false)}
                publishableKey={settings?.stripePublishableKey || ""}
                secretKeyEnc={settings?.stripeSecretKeyEnc || ""}
                amount={totalWithTip}
                description={`${companyName} — ${e?.lineItems?.[0]?.description || "Estimate"} #${e?.id || ""}`}
                onSuccess={(paymentIntentId) => { setShowStripeModal(false); handleApprove(paymentIntentId); }}
              />
            </div>
          )}

          {/* STEP 4: Done */}
          {step === "done" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center mx-auto">
                <CheckCircle size={40} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">You're all set, {c.firstName}!</div>
                <div className="text-white/60 text-sm mt-2">Your estimate has been approved and signed.</div>
              </div>
              <Glass className="p-4 !bg-green-950/20 !border-green-700/30 text-left">
                <div className="text-xs text-white/60 mb-1">What happens next?</div>
                <div className="text-sm space-y-1.5">
                  <div>✅ Payment of {fmt(totalWithTip)} processed</div>
                  <div>📱 You'll receive a confirmation text shortly</div>
                  <div>📅 We'll contact you to confirm your service date</div>
                  <div>⭐ After service, we'll ask for a quick review</div>
                </div>
              </Glass>
              {/* Download signed PDF */}
              <button onClick={() => {
                const companyName = settings?.companyName || "Smock's Pressure Washing";
                const html = `<!DOCTYPE html><html><head><title>Signed Estimate</title><style>
                  body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:auto;color:#111}
                  h1{color:#dc2626;margin-bottom:4px}
                  .header{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #dc2626}
                  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px}
                  .total{font-size:16px;font-weight:bold;color:#dc2626}
                  .sig-box{margin-top:24px;padding:16px;border:1px solid #ccc;border-radius:8px;background:#f9f9f9}
                  .badge{display:inline-block;background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:bold}
                  table{width:100%;border-collapse:collapse;margin:16px 0}
                  th{background:#f5f5f5;text-align:left;padding:8px;font-size:11px;text-transform:uppercase}
                  td{padding:8px;border-bottom:1px solid #eee;font-size:13px}
                </style></head><body>
                <div class="header">
                  <div><h1>${companyName}</h1><div style="font-size:12px;color:#666">York, PA · ${settings?.companyPhone || "(717) 555-0100"}</div></div>
                  <div style="text-align:right"><div style="font-weight:bold">SIGNED ESTIMATE</div><div style="font-size:12px;color:#666">#${e.id.slice(-8).toUpperCase()}</div><div style="font-size:12px;color:#666">${new Date().toLocaleDateString()}</div></div>
                </div>
                <div style="margin-bottom:16px"><strong>Customer:</strong> ${c.firstName} ${c.lastName}<br><span style="font-size:12px;color:#666">${c.address || ""} · ${c.email || ""} · ${c.phone || ""}</span></div>
                <table><thead><tr><th>Service</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>
                ${(e.lineItems || []).map(li => `<tr><td>${li.description}</td><td>${li.quantity}</td><td>$${Number(li.unitPrice).toFixed(2)}</td><td>$${(li.quantity * li.unitPrice).toFixed(2)}</td></tr>`).join("")}
                </tbody></table>
                ${e.discount > 0 ? `<div class="row"><span>Discount</span><span>-$${Number(e.discount).toFixed(2)}</span></div>` : ""}
                <div class="row"><span>Tax (${settings?.taxRate || 6}%)</span><span>$${Number(e.tax || 0).toFixed(2)}</span></div>
                <div class="row total"><span>TOTAL</span><span>$${Number(e.total).toFixed(2)}</span></div>
                ${totalWithTip > e.total ? `<div class="row" style="color:green"><span>Tip</span><span>+$${tip.toFixed(2)}</span></div><div class="row total"><span>AMOUNT PAID</span><span>$${totalWithTip.toFixed(2)}</span></div>` : ""}
                ${e.terms ? `<div style="margin-top:16px;padding:12px;background:#f9f9f9;border-radius:6px;font-size:11px;color:#555"><strong>Terms & Conditions:</strong><br>${e.terms}</div>` : ""}
                <div class="sig-box">
                  <div style="font-size:12px;color:#666;margin-bottom:8px">Electronic Signature</div>
                  ${sigData ? `<img src="${sigData}" style="max-height:80px;border-bottom:1px solid #ccc;display:block" />` : "<div style='height:60px;border-bottom:1px solid #ccc'></div>"}
                  <div style="margin-top:8px;font-size:11px;color:#666">Signed by: ${c.firstName} ${c.lastName} · ${new Date().toLocaleString()} · <span class="badge">✓ SIGNED</span></div>
                </div>
                <div style="margin-top:24px;font-size:10px;color:#999;text-align:center">This is a legally binding electronic document. ${companyName} · York, PA</div>
                <script>window.onload=()=>setTimeout(window.print,300)</script>
                </body></html>`;
                const w = window.open("", "_blank");
                if (w) { w.document.write(html); w.document.close(); }
              }} className="w-full flex items-center justify-center gap-2 py-3 bg-green-900/30 border border-green-700/40 text-green-300 rounded-xl hover:bg-green-900/50 transition text-sm font-medium">
                <Download size={16} /> Download Signed Estimate PDF
              </button>
              {/* Receipt PDF */}
              <button onClick={() => {
                const companyName = settings?.companyName || "Smock's Pressure Washing";
                const receiptHtml = `<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:Arial;padding:40px;max-width:500px;margin:auto;color:#111}.logo{font-size:22px;font-weight:bold;color:#dc2626}.receipt-box{border:2px solid #dc2626;border-radius:8px;padding:24px;margin:20px 0}.line{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px}.total{font-size:18px;font-weight:bold;color:#dc2626;margin-top:8px}.stamp{background:#dcfce7;border:2px solid #16a34a;color:#14532d;padding:10px;text-align:center;border-radius:8px;font-weight:bold;margin-top:16px;font-size:15px}@media print{body{padding:20px}}</style></head><body>
                <div class="logo">${companyName}</div><div style="font-size:11px;color:#666">York, PA · (717) 555-0100</div>
                <div class="receipt-box">
                  <div style="text-align:center;margin-bottom:16px"><div style="font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#666">Payment Receipt</div><div style="font-size:11px;color:#999">${new Date().toLocaleString()}</div></div>
                  <div class="line"><span>Customer</span><span>${c.firstName} ${c.lastName}</span></div>
                  ${e.lineItems.map(li => `<div class="line"><span>${li.description}</span><span>$${(li.quantity * li.unitPrice).toFixed(2)}</span></div>`).join("")}
                  ${e.discount > 0 ? `<div class="line"><span>Discount</span><span>-$${Number(e.discount).toFixed(2)}</span></div>` : ""}
                  <div class="line"><span>Tax</span><span>$${Number(e.tax || 0).toFixed(2)}</span></div>
                  <div class="line total"><span>AMOUNT PAID</span><span>$${totalWithTip.toFixed(2)}</span></div>
                  ${tip > 0 ? `<div class="line"><span style="font-size:11px;color:#999">Includes tip</span><span style="font-size:11px;color:#999">$${tip.toFixed(2)}</span></div>` : ""}
                  <div class="stamp">✓ PAYMENT RECEIVED</div>
                  <div style="margin-top:12px;font-size:10px;color:#888;text-align:center">Thank you for your business! · ${companyName}</div>
                </div>
                <script>window.onload=()=>setTimeout(window.print,300)<\/script></body></html>`;
                const w = window.open("", "_blank");
                if (w) { w.document.write(receiptHtml); w.document.close(); }
              }} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-900/30 border border-blue-700/40 text-blue-300 rounded-xl hover:bg-blue-900/50 transition text-sm font-medium">
                <Receipt size={16} /> Download Receipt PDF
              </button>
              <GBtn onClick={onClose} className="w-full">Close</GBtn>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
