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

export function DocumentVault({ customerId }) {
  const [docs, setDocs] = usePersistent("smocks.docvault." + customerId, []) as [any[], any];
  const [uploading, setUploading] = useState(false);

  const handleUpload = e => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const file = f as File;
      const r = new FileReader();
      r.onload = ev => {
        setDocs(prev => [...prev, {
          id: uid(),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: ev.target.result,
          uploadedAt: today(),
          category: file.name.toLowerCase().includes("contract") ? "Contract" : file.name.toLowerCase().includes("waiver") ? "Waiver" : file.name.toLowerCase().includes("hoa") ? "HOA" : "Document"
        }]);
      };
      r.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const download = doc => {
    const a = document.createElement("a");
    a.href = doc.dataUrl;
    a.download = doc.name;
    a.click();
  };

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5">
        <div className="text-xs font-semibold flex items-center gap-1.5"><FileText size={11} className="text-blue-400" />Document Vault</div>
        <label className="cursor-pointer px-2 py-1 bg-blue-900/30 border border-blue-700/40 text-blue-300 rounded-lg text-[10px] hover:bg-blue-900/50 flex items-center gap-1">
          <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" multiple className="hidden" onChange={handleUpload} />
          <Plus size={10} /> Upload
        </label>
      </div>
      {docs.length === 0
        ? <div className="py-5 text-center text-[11px] text-white/40">No documents uploaded. Upload contracts, waivers, or HOA approvals.</div>
        : <div className="divide-y divide-white/5">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/5">
              <span className="text-base">{doc.type.includes("pdf") ? "📄" : doc.type.includes("image") ? "🖼️" : "📋"}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{doc.name}</div>
                <div className="text-[10px] text-white/40">{doc.category} · {doc.uploadedAt} · {(doc.size / 1024).toFixed(0)}KB</div>
              </div>
              <button onClick={() => download(doc)} className="p-1 text-white/40 hover:text-blue-400"><Download size={11} /></button>
              <button onClick={() => setDocs(prev => prev.filter(d => d.id !== doc.id))} className="p-1 text-white/40 hover:text-red-400"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

