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

// Records and transcribes voice input — Whisper API when an OpenAI key is
// configured (more accurate, works on any browser), otherwise the browser's
// built-in SpeechRecognition (no key needed, Chromium-based browsers only).
//
// Two modes, click to start/stop (no more hold-and-release-to-send, which
// made it impossible to fix a misheard word before it went out):
// - "dictate" (STT): transcript lands in the input box for the user to read,
//   edit, and send themselves via onTranscript(text, false).
// - "note": transcript is sent immediately via onTranscript(text, true) once
//   the recording is stopped — the voice note IS the message.
export function VoiceMicButton({ onTranscript, apiKey, mode = "dictate" }: { onTranscript?: (text: string, autoSend: boolean) => void; apiKey?: any; mode?: "dictate" | "note" }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionCtor = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const autoSend = mode === "note";

  const startWhisperRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const fd = new FormData();
          fd.append("file", blob, "voice.webm");
          fd.append("model", "whisper-1");
          fd.append("language", "en");
          const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: "Bearer " + apiKey },
            body: fd
          });
          const data = await res.json();
          if (data.text) onTranscript?.(data.text.trim(), autoSend);
          else if (data.error) console.warn("Whisper transcription failed:", data.error);
        } catch (e) {
          console.error("Whisper error:", e);
        } finally {
          setProcessing(false);
        }
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      alert("Microphone access denied");
    }
  };

  const startBrowserRecognition = () => {
    if (!SpeechRecognitionCtor) { alert("Voice input isn't supported in this browser. Try Chrome, or add an OpenAI key in Settings for Whisper transcription."); return; }
    const rec = new SpeechRecognitionCtor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) onTranscript?.(text.trim(), autoSend);
    };
    rec.onerror = () => { /* user cancelled or no speech — nothing to report */ };
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const toggleRecording = () => {
    if (recording) {
      if (apiKey) mediaRef.current?.stop();
      else recognitionRef.current?.stop();
      setRecording(false);
    } else {
      apiKey ? startWhisperRecording() : startBrowserRecognition();
    }
  };

  if (processing) return <div className="p-2 text-white/40"><div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <button
      onClick={toggleRecording}
      title={recording ? "Click to stop recording" : mode === "note" ? "Record a voice note — sends automatically when stopped" : "Dictate — transcript lands in the text box to review before sending"}
      className={"p-2 rounded-xl transition flex-shrink-0 " + (recording ? "bg-red-600/40 text-red-300 animate-pulse" : "text-white/40 hover:text-white/70 hover:bg-white/5")}
    >
      <Mic size={16} />
    </button>
  );
}

