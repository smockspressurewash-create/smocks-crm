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

export function ChemicalModal({ open, onClose, data, onSave }) {
  const [f, setF] = useState({ name: "", brand: "", category: "Surfactant", stock: 0, reorderLevel: 5, unitCost: 0 });
  useEffect(() => { if (open) setF(data || { name: "", brand: "", category: "Surfactant", stock: 0, reorderLevel: 5, unitCost: 0 }); }, [open, data]);
  return <Modal open={open} onClose={onClose} title={data ? "Edit Chemical" : "New Chemical"}>
    <div className="space-y-3">
      <div><label className="text-xs text-white/60 mb-1 block">Name *</label><GInput value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-white/60 mb-1 block">Brand</label><GInput value={f.brand} onChange={e => setF({ ...f, brand: e.target.value })} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Category</label><GInput value={f.category} onChange={e => setF({ ...f, category: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs text-white/60 mb-1 block">Stock</label><GInput type="number" value={f.stock} onChange={e => setF({ ...f, stock: e.target.value })} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Reorder</label><GInput type="number" value={f.reorderLevel} onChange={e => setF({ ...f, reorderLevel: e.target.value })} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Unit $</label><GInput type="number" step="0.01" value={f.unitCost} onChange={e => setF({ ...f, unitCost: e.target.value })} /></div>
      </div>
      <div className="flex gap-2 justify-end pt-3"><GBtn variant="ghost" onClick={onClose}>Cancel</GBtn><GBtn onClick={() => { if (!f.name) return; onSave(data ? { ...data, ...f, stock: Number(f.stock), reorderLevel: Number(f.reorderLevel), unitCost: Number(f.unitCost) } : { ...f, stock: Number(f.stock), reorderLevel: Number(f.reorderLevel), unitCost: Number(f.unitCost) }); }}>{data ? "Save" : "Add"}</GBtn></div>
    </div>
  </Modal>;
}

// ===== REPORTS =====
// ===== CREW VIEW (field-optimized, mobile-first) =====
// ===== GOOGLE WORKSPACE PAGE =====
