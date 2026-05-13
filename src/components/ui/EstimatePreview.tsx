// @ts-nocheck
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
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { Stat } from "./Stat";
import { PBar } from "./PBar";
import { PageFade } from "./PageFade";
import { TimeframeSelector } from "./TimeframeSelector";

export function EstimatePreview({ estimate: e, customers = [], onClose, onApprove, onConvert }) {
  if (!e) return null;
  const c = customers.find(x => x.id === e.customerId);

  return (
    <Modal open={!!e} onClose={onClose} title={"Estimate #" + e.id.toUpperCase()} maxW="max-w-2xl">
      <div className="bg-white text-black rounded-xl p-6">
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-red-600">
          <div><div className="text-2xl font-bold text-red-700">Smock's Pressure Washing</div><div className="text-xs text-gray-600 mt-1">Professional Exterior Cleaning</div></div>
          <div className="text-right text-sm"><div className="font-bold text-gray-800">{e.invoiced ? "INVOICE" : "ESTIMATE"}</div><div className="text-xs text-gray-600">#{e.id.toUpperCase()} · {e.createdAt}</div></div>
        </div>
        <div className="mb-5 text-sm"><div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Bill to</div><div className="font-semibold">{c?.firstName} {c?.lastName}</div><div className="text-gray-600 text-xs">{c?.address}</div></div>
        <table className="w-full text-sm mb-4">
          <thead><tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500"><th className="text-left py-2">Description</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Unit</th><th className="text-right py-2">Amount</th></tr></thead>
          <tbody>{(e.lineItems || []).map(li => <tr key={li.id} className="border-b border-gray-100"><td className="py-2">{li.description}</td><td className="text-right py-2">{li.quantity}</td><td className="text-right py-2">{fmt(li.unitPrice)}</td><td className="text-right py-2 font-medium">{fmt(li.quantity * li.unitPrice)}</td></tr>)}</tbody>
        </table>
        <div className="ml-auto w-56 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{fmt(e.subtotal)}</span></div>
          {e.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>− {fmt(e.discount)}</span></div>}
          <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{fmt(e.tax)}</span></div>
          {e.depositRequired > 0 && <div className="flex justify-between text-yellow-700"><span>Deposit required</span><span>{fmt(e.depositRequired)}</span></div>}
          <div className="flex justify-between font-bold text-base border-t-2 border-red-600 pt-1 text-red-700"><span>Total</span><span>{fmt(e.total)}</span></div>
        </div>
        {e.notes && <div className="mt-5 pt-4 border-t border-gray-200"><div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Notes</div><div className="text-xs text-gray-700 whitespace-pre-wrap">{e.notes}</div></div>}
        {e.customerNotes && <div className="mt-3 pt-3 border-t border-gray-100"><div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Message from Smock's</div><div className="text-sm text-gray-800 bg-blue-50 border border-blue-200 rounded-lg p-3">{e.customerNotes}</div></div>}
        {e.terms && <div className="mt-4 text-[10px] text-gray-500 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-3"><div className="uppercase tracking-wider mb-1 font-semibold">Terms</div>{e.terms}</div>}
        <div className="mt-6 pt-4 border-t border-gray-300 grid grid-cols-2 gap-6 text-xs">
          <div><div className="text-gray-500 uppercase tracking-wider mb-4 text-[10px]">Customer signature</div><div className="border-b border-gray-400 h-8">{e.signedAt && <div className="italic text-red-700 text-sm">{c?.firstName} {c?.lastName}</div>}</div>{e.signedAt && <div className="text-[10px] text-gray-500 mt-1">Signed {e.signedAt}</div>}</div>
          <div><div className="text-gray-500 uppercase tracking-wider mb-4 text-[10px]">Date</div><div className="border-b border-gray-400 h-8">{e.signedAt && <div className="text-sm">{e.signedAt}</div>}</div></div>
        </div>
      </div>
      <div className="mt-5 flex gap-2 flex-wrap">
        {e.status === "pending" && <GBtn onClick={() => onApprove(e.id)} className="flex-1"><CheckCircle size={14} className="inline mr-1.5" />Approve Estimate</GBtn>}
        {e.status === "approved" && !e.invoiced && onConvert && <GBtn onClick={() => onConvert(e.id)} className="flex-1"><Receipt size={14} className="inline mr-1.5" />Convert to Invoice</GBtn>}
        {e.status === "approved" && onSchedule && <GBtn variant="ghost" onClick={() => onSchedule(e)} className="flex-1"><Briefcase size={14} className="inline mr-1.5" />Schedule Job</GBtn>}
        {e.invoiced && !e.paidAt && <GBtn variant="ghost" onClick={() => {
          const link = "smocks.com/portal/" + e.id + "?t=" + Date.now();
          navigator.clipboard?.writeText(link).catch(() => {});
          toast("Payment link copied: " + link);
        }} className="flex-1 !text-xs !border-yellow-700/40 !text-yellow-300"><RefreshCw size={12} className="inline mr-1" />Regen Pay Link</GBtn>}
        {e.invoiced && e.paidAt && <div className="flex-1 text-center py-2.5 rounded-xl bg-green-950/30 border border-green-700/40 text-green-300 text-sm flex items-center justify-center gap-1.5"><CheckCircle size={14} />Paid {e.paidAt}</div>}
        {e.invoiced && !e.paidAt && <div className="flex-1 text-center py-2.5 rounded-xl bg-yellow-950/30 border border-yellow-700/40 text-yellow-300 text-sm flex items-center justify-center gap-1.5"><Clock size={14} />Invoiced — awaiting payment</div>}
      </div>
    </Modal>
  );
}

// ===== JOBS =====
// ===== BEFORE/AFTER SLIDER =====
