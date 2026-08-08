// auto-extracted from Crew Boss OS monolith
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
import { supabase } from "../../lib/supabase";
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

export function CustomersPage({ customers = [], setCustomers, estimates = [], jobs = [], employees = [], toast, timeline = {}, setTimeline = () => {}, settings = {} as AppSettings, setSettings = (() => {}) as any }: { customers?: any[]; setCustomers?: any; estimates?: any[]; jobs?: any[]; employees?: any[]; toast?: any; timeline?: any; setTimeline?: any; settings?: AppSettings; setSettings?: any }) {
  const [search, setSearch] = useState("");
  // FEATURE — filter/sort controls for the customer list (previously just a
  // plain text search with no way to sort or filter by tag).
  const [sortBy, setSortBy] = useState<"name" | "dateAdded" | "lastJob" | "totalSpent">("name");
  const [tagFilter, setTagFilter] = useState("");
  // FEATURE — customer folders, simplified to a single flat folder name per
  // customer with a filter dropdown (not nested subfolders/drag-and-drop —
  // see CustomerModal's folder field for how a customer gets assigned one).
  const [folderFilter, setFolderFilter] = useState("");
  // AUDIT FIX — folder management (add/rename/delete/nest/drag-drop). Nesting
  // is a "Parent/Child" naming convention on the same flat string field
  // (no schema change) — a customer's folder is still just one string, but
  // the UI splits on "/" to render and manage it as a tree. Empty folders
  // (no customers yet) need to exist SOMEWHERE independent of any customer
  // row, hence settings.customerFolders as the master list.
  const [folderManagerOpen, setFolderManagerOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draggedCustomerId, setDraggedCustomerId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [modal, setModal] = useState({ open: false, data: null });
  const [detail, setDetail] = useState(null);
  const [pageTab, setPageTab] = useState("list"); // list | analytics | duplicates
  const [dupPairs, setDupPairs] = useState(null); // null = not scanned, [] = no dupes
  const [mergeModal, setMergeModal] = useState(null); // { a, b }
  const [mergeChoices, setMergeChoices] = useState({}); // field → "a" | "b"
  const [mergeMode, setMergeMode] = useState(false);
  const [mergePair, setMergePair] = useState([]);
  const fileRef = useRef(null);
  // FEATURE 5 (mobile round 7) — bulk select mode, separate from mergeMode
  // (which is capped at exactly 2 rows for a different purpose).
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const toggleBulk = (id: string) => setBulkSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const toggleMerge = id => setMergePair(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev);

  const doSimpleMerge = () => {
    if (mergePair.length !== 2) return;
    const [aId, bId] = mergePair;
    const a = customers.find(c => c.id === aId);
    const b = customers.find(c => c.id === bId);
    if (!a || !b) return;
    const merged = { ...a, ...b, id: a.id, totalSpent: (a.totalSpent || 0) + (b.totalSpent || 0), notes: [a.notes, b.notes].filter(Boolean).join(" | ") };
    setCustomers(customers.filter(c => c.id !== bId).map(c => c.id === aId ? merged : c));
    setMergeMode(false);
    setMergePair([]);
    toast("Customers merged ✓");
  };

  const allCustomerTags = Array.from(new Set(customers.flatMap((c: any) => c.tags || []))).sort();
  const allCustomerFolders = Array.from(new Set(customers.map((c: any) => c.folder).filter(Boolean))).sort();
  // Union of folders that actually have a customer in them AND folders that
  // exist only because the owner explicitly created them (still empty).
  const masterFolders = Array.from(new Set([...(settings.customerFolders || []), ...allCustomerFolders])).sort();
  // Every folder AND every ancestor path implied by "/"-nested names, so
  // "Commercial/Restaurants" also surfaces a "Commercial" node in the tree
  // even if no customer/created-folder is filed directly under "Commercial"
  // itself.
  const allFolderPaths = Array.from(new Set(masterFolders.flatMap(f => {
    const parts = f.split("/");
    return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
  }))).sort();
  const folderDepth = (path: string) => path.split("/").length - 1;
  const folderLabel = (path: string) => path.split("/").pop() || path;
  const folderCustomerCount = (path: string) => customers.filter((c: any) => c.folder === path || (c.folder || "").startsWith(path + "/")).length;

  const renameFolder = (oldPath: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === folderLabel(oldPath)) { setRenamingFolder(null); return; }
    const parent = oldPath.includes("/") ? oldPath.slice(0, oldPath.lastIndexOf("/")) : "";
    const newPath = parent ? `${parent}/${trimmed}` : trimmed;
    if (allFolderPaths.includes(newPath)) { toast?.("A folder with that name already exists here", "red"); return; }
    // Re-point this folder AND every descendant ("oldPath/...") to the new path.
    setCustomers((prev: any[]) => prev.map((c: any) => {
      if (c.folder === oldPath) return { ...c, folder: newPath };
      if ((c.folder || "").startsWith(oldPath + "/")) return { ...c, folder: newPath + c.folder.slice(oldPath.length) };
      return c;
    }));
    setSettings((s: any) => ({
      ...s,
      customerFolders: (s.customerFolders || []).map((f: string) =>
        f === oldPath ? newPath : f.startsWith(oldPath + "/") ? newPath + f.slice(oldPath.length) : f
      ),
    }));
    setRenamingFolder(null);
    if (folderFilter === oldPath) setFolderFilter(newPath);
    toast?.("Folder renamed ✓");
  };

  const deleteFolder = (path: string) => {
    const count = folderCustomerCount(path);
    if (!confirm(count > 0 ? `Delete "${folderLabel(path)}"? ${count} customer(s) will become unfiled (not deleted).` : `Delete empty folder "${folderLabel(path)}"?`)) return;
    setCustomers((prev: any[]) => prev.map((c: any) => (c.folder === path || (c.folder || "").startsWith(path + "/")) ? { ...c, folder: "" } : c));
    setSettings((s: any) => ({ ...s, customerFolders: (s.customerFolders || []).filter((f: string) => f !== path && !f.startsWith(path + "/")) }));
    if (folderFilter === path) setFolderFilter("");
    toast?.("Folder deleted ✓");
  };

  const createFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const path = newFolderParent ? `${newFolderParent}/${trimmed}` : trimmed;
    if (allFolderPaths.includes(path)) { toast?.("That folder already exists", "red"); return; }
    setSettings((s: any) => ({ ...s, customerFolders: [...(s.customerFolders || []), path] }));
    setNewFolderName("");
    toast?.("Folder created ✓");
  };

  const moveCustomerToFolder = (customerId: string, folderPath: string) => {
    setCustomers((prev: any[]) => prev.map((c: any) => c.id === customerId ? { ...c, folder: folderPath } : c));
    const cust = customers.find((c: any) => c.id === customerId);
    toast?.(`${cust?.firstName || "Customer"} moved to ${folderPath || "Unfiled"} ✓`);
  };
  // Last-job-scheduled date per customer, used for the "Last Job" sort — not
  // stored on the customer record itself, so derived from jobs here.
  const lastJobDateByCustomer = (() => {
    const m: Record<string, string> = {};
    for (const j of jobs as any[]) {
      if (!j.customerId || !j.scheduledDate) continue;
      if (!m[j.customerId] || j.scheduledDate > m[j.customerId]) m[j.customerId] = j.scheduledDate;
    }
    return m;
  })();
  const filtered = customers
    .filter(c => (c.firstName + " " + c.lastName + " " + c.email + " " + c.phone).toLowerCase().includes(search.toLowerCase()))
    .filter(c => !tagFilter || (c.tags || []).includes(tagFilter))
    .filter(c => !folderFilter || (folderFilter === "__unfiled__" ? !c.folder : c.folder === folderFilter))
    .slice()
    .sort((a: any, b: any) => {
      if (sortBy === "name") return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (sortBy === "dateAdded") return (b.createdAt || "").localeCompare(a.createdAt || "");
      if (sortBy === "totalSpent") return (Number(b.totalSpent) || 0) - (Number(a.totalSpent) || 0);
      if (sortBy === "lastJob") return (lastJobDateByCustomer[b.id] || "").localeCompare(lastJobDateByCustomer[a.id] || "");
      return 0;
    });
  const toggleBulkAll = () => setBulkSelected(bulkSelected.length === filtered.length ? [] : filtered.map(c => c.id));

  const downloadSelectedCsv = () => {
    const rows = [["firstName", "lastName", "email", "phone", "address", "totalSpent", "createdAt"]];
    customers.filter(c => bulkSelected.includes(c.id)).forEach(c => rows.push([c.firstName, c.lastName, c.email, c.phone, c.address, c.totalSpent, c.createdAt]));
    const csv = rows.map(r => r.map(v => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "customers-selected-" + today() + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Downloaded ${bulkSelected.length} customer${bulkSelected.length !== 1 ? "s" : ""}`);
  };
  const deleteSelectedCustomers = () => {
    if (bulkSelected.length === 0) return;
    if (!window.confirm(`Permanently delete ${bulkSelected.length} customer${bulkSelected.length !== 1 ? "s" : ""}? This can't be undone.`)) return;
    const ids = [...bulkSelected];
    setCustomers(customers.filter(c => !ids.includes(c.id)));
    setBulkSelected([]);
    (supabase as any).from("customers").delete().in("id", ids)
      .then((r: any) => { if (r?.error) toast("Deleted locally, but failed to delete from server — " + r.error.message, "red"); else toast(ids.length + " customer(s) deleted"); })
      .catch((e: any) => toast("Deleted locally, but failed to delete from server — " + (e?.message || ""), "red"));
  };

  // BLOCKER — this only ever called setCustomers (local state), same gap
  // App.tsx's own 30s bulk customer autosave was added to paper over ("no
  // write path to Supabase at all... only looked true on the single device
  // that created the record"). But that bulk save is up to 30s delayed and
  // has no per-edit success/failure feedback — editing a customer and
  // checking another device (or this same one, right after) within that
  // window shows the OLD data, reading as "editing doesn't work" even
  // though it eventually syncs. Writing immediately here, with its own
  // toast, closes that gap the same way jobs/crew writes already were.
  const save = (d: any) => {
    const isNew = !d.id;
    let record = d;
    if (isNew) {
      const id = uid();
      // A stable, real referral code generated once at creation — not derived
      // on the fly from the id, so it survives independently and reads cleanly.
      const referralCode = (d.firstName?.slice(0, 3) || "REF").toUpperCase() + id.slice(-4).toUpperCase();
      record = { ...d, id, totalSpent: 0, createdAt: today(), referralCode };
    }
    setCustomers(isNew ? [...customers, record] : customers.map(c => c.id === record.id ? record : c));
    setModal({ open: false, data: null });
    (supabase as any).from("customers").upsert(record, { onConflict: "id" })
      .then(async (result: any) => {
        if (result?.error) {
          // BUG FIX — `folder` (new field, migration 0024) not existing yet
          // would otherwise reject the WHOLE customer save, silently dropping
          // every other edited field too (same "one bad column poisons the
          // whole write" pattern documented throughout this project).
          if ("folder" in record) {
            console.warn("[CustomersPage] save failed:", result.error.message, "— retrying without folder");
            const { folder, ...coreRecord } = record;
            const retry = await (supabase as any).from("customers").upsert(coreRecord, { onConflict: "id" });
            if (retry?.error) { console.error("[CustomersPage] core retry also failed:", retry.error.message); toast("Saved locally, but failed to sync — " + retry.error.message, "red"); }
            else toast("Saved, but folder needs a pending database migration to sync", "yellow");
            return;
          }
          console.error("[CustomersPage] save failed:", result.error.message); toast("Saved locally, but failed to sync — " + result.error.message, "red");
        }
        else toast("Customer saved ✓", "green");
      })
      .catch((e: any) => { console.error("[CustomersPage] save threw:", e?.message); toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red"); });
  };

  const deleteCustomer = (c: any) => {
    setCustomers(customers.filter(x => x.id !== c.id));
    setDetail(null);
    (supabase as any).from("customers").delete().eq("id", c.id)
      .then((result: any) => { if (result?.error) toast("Deleted locally, but failed to delete from server — " + result.error.message, "red"); else toast("Customer deleted"); })
      .catch((e: any) => toast("Deleted locally, but failed to delete from server — " + (e?.message || ""), "red"));
  };

  // Scan for duplicates by name similarity, phone, or email
  const scanDuplicates = () => {
    const pairs = [];
    const seen = new Set();
    for (let i = 0; i < customers.length; i++) {
      for (let j = i + 1; j < customers.length; j++) {
        const a = customers[i], b = customers[j];
        const key = [a.id, b.id].sort().join("-");
        if (seen.has(key)) continue;
        const nameA = (a.firstName + " " + a.lastName).toLowerCase().trim();
        const nameB = (b.firstName + " " + b.lastName).toLowerCase().trim();
        const samePhone = a.phone && b.phone && a.phone.replace(/\D/g,"") === b.phone.replace(/\D/g,"");
        const sameEmail = a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();
        const sameName = nameA === nameB || (nameA.length > 3 && nameB.startsWith(nameA.slice(0,4)));
        if (samePhone || sameEmail || sameName) {
          const reason = samePhone ? "Same phone" : sameEmail ? "Same email" : "Similar name";
          pairs.push({ a, b, reason });
          seen.add(key);
        }
      }
    }
    setDupPairs(pairs);
    setPageTab("duplicates");
    toast(pairs.length > 0 ? "Found " + pairs.length + " potential duplicate" + (pairs.length !== 1 ? "s" : "") : "No duplicates found ✓");
  };

  // Smart merge — user picks which field wins
  const openMerge = (a, b) => {
    const choices = {};
    const fields = ["firstName","lastName","phone","email","address","notes","leadSource","sqFootage","gateCode"];
    fields.forEach(f => { choices[f] = a[f] ? "a" : "b"; });
    setMergeChoices(choices);
    setMergeModal({ a, b });
  };

  const doMerge = () => {
    const { a, b } = mergeModal;
    const merged = { ...a };
    Object.entries(mergeChoices).forEach(([field, choice]) => { merged[field] = choice === "a" ? a[field] : b[field]; });
    merged.totalSpent = (a.totalSpent || 0) + (b.totalSpent || 0);
    merged.tags = [...new Set([...(a.tags||[]), ...(b.tags||[])])];
    setCustomers(customers.filter(c => c.id !== b.id).map(c => c.id === a.id ? merged : c));
    setDupPairs(prev => prev?.filter(p => !(p.a.id === a.id && p.b.id === b.id)));
    setMergeModal(null);
    toast("Merged: " + merged.firstName + " " + merged.lastName + " ✓");
  };

  const exportCSV = () => {
    const rows = [["firstName", "lastName", "email", "phone", "address", "totalSpent", "createdAt", "gateCode", "hasDog", "dogName", "sensitivePlants", "notes"]];
    customers.forEach(c => rows.push([c.firstName, c.lastName, c.email, c.phone, c.address, c.totalSpent, c.createdAt, c.gateCode || "", c.hasDog ? "yes" : "", c.dogName || "", c.sensitivePlants || "", c.notes || ""]));
    const csv = rows.map(r => r.map(v => '"' + String(v || "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(u);
    toast("Exported " + customers.length + " customers");
  };

  const importCSV = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const lines = (r.result as string).split(/\r?\n/).filter(Boolean);
        const [hdr, ...rows] = lines;
        const cols = hdr.split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());

        // Flexible field mapping — handles Markate, generic CSVs, and our own format
        const fieldMap = {
          firstName: ["firstname", "first_name", "first name", "fname", "given name"],
          lastName: ["lastname", "last_name", "last name", "lname", "surname", "family name"],
          email: ["email", "email address", "e-mail"],
          phone: ["phone", "phonenumber", "phone_number", "phone number", "mobile", "cell"],
          address: ["address", "street", "street address", "property address", "location"],
          notes: ["notes", "note", "comments", "description"],
          leadSource: ["leadsource", "lead_source", "lead source", "source", "how found"],
          tags: ["tags", "tag", "customer type", "type"],
          totalSpent: ["totalspent", "total_spent", "total spent", "revenue", "ltv"],
          sqFootage: ["sqfootage", "sq_footage", "sqft", "square feet", "sq ft"],
          gateCode: ["gatecode", "gate_code", "gate code", "access code"]
        };

        const getField = (obj, fieldKey) => {
          const aliases = fieldMap[fieldKey] || [fieldKey];
          for (const alias of aliases) {
            const found = Object.keys(obj).find(k => k.toLowerCase() === alias);
            if (found) return obj[found];
          }
          return "";
        };

        const imported = rows.map(ln => {
          // Handle quoted CSV fields correctly
          const vals = [];
          let current = "", inQuote = false;
          for (const ch of ln) {
            if (ch === '"') { inQuote = !inQuote; }
            else if (ch === "," && !inQuote) { vals.push(current.trim()); current = ""; }
            else { current += ch; }
          }
          vals.push(current.trim());

          const raw = {};
          cols.forEach((k, i) => raw[k] = vals[i] || "");

          return {
            id: uid(),
            firstName: getField(raw, "firstName"),
            lastName: getField(raw, "lastName"),
            email: getField(raw, "email"),
            phone: getField(raw, "phone"),
            address: getField(raw, "address"),
            notes: getField(raw, "notes"),
            leadSource: getField(raw, "leadSource"),
            tags: getField(raw, "tags") ? [getField(raw, "tags")] : [],
            totalSpent: Number(getField(raw, "totalSpent").replace(/[^0-9.]/g, "")) || 0,
            sqFootage: getField(raw, "sqFootage"),
            gateCode: getField(raw, "gateCode"),
            createdAt: today(),
            pipelineStage: "lead"
          };
        }).filter(c => c.firstName || c.lastName);

        if (imported.length) {
          // Duplicate detection — skip if email matches existing
          const existing = new Set(customers.map(c => c.email?.toLowerCase()).filter(Boolean));
          const fresh = imported.filter(c => !c.email || !existing.has(c.email.toLowerCase()));
          const dupes = imported.length - fresh.length;
          setCustomers(prev => [...prev, ...fresh]);
          toast("✅ Imported " + fresh.length + " customers" + (dupes > 0 ? " · " + dupes + " duplicates skipped" : ""));
        } else {
          toast("No valid rows found. Check column headers (need First Name, Last Name).", "error");
        }
      } catch (err) { toast("Import failed: " + err.message, "error"); }
    };
    r.readAsText(file);
    e.target.value = "";
  };

  const quickAction = (kind, c) => {
    if (kind === "call" && c.phone) { window.location.href = "tel:" + c.phone.replace(/\D/g, ""); return; }
    if (kind === "text" && c.phone) { window.location.href = "sms:" + c.phone.replace(/\D/g, ""); return; }
    if (kind === "email" && c.email) { window.location.href = "mailto:" + c.email; return; }
    toast("No contact info for " + kind);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2 items-center">
          {["list", "analytics", "duplicates"].map(t => <button key={t} onClick={() => { setPageTab(t); if (t === "duplicates" && dupPairs === null) scanDuplicates(); }} className={"px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition " + (pageTab === t ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>{t === "analytics" ? "📊 LTV Analytics" : t === "duplicates" ? "🔍 Find Duplicates" + (dupPairs?.length > 0 ? " (" + dupPairs.length + ")" : "") : "👥 Customers"}</button>)}
          {pageTab === "list" && <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <GInput placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="!pl-9 !py-1.5 !text-xs" />
          </div>}
          {pageTab === "list" && (
            <GSel value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="!py-1.5 !text-xs !w-auto">
              <option value="name">Sort: Name</option>
              <option value="dateAdded">Sort: Date Added</option>
              <option value="lastJob">Sort: Last Job</option>
              <option value="totalSpent">Sort: Total Spent</option>
            </GSel>
          )}
          {pageTab === "list" && allCustomerTags.length > 0 && (
            <GSel value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="!py-1.5 !text-xs !w-auto">
              <option value="">All Tags</option>
              {allCustomerTags.map((t: string) => <option key={t} value={t}>{t}</option>)}
            </GSel>
          )}
          {pageTab === "list" && (
            <GSel value={folderFilter} onChange={e => setFolderFilter(e.target.value)} className="!py-1.5 !text-xs !w-auto">
              <option value="">📁 All Folders</option>
              <option value="__unfiled__">Unfiled</option>
              {allFolderPaths.map((f: string) => <option key={f} value={f}>{"—".repeat(folderDepth(f))} 📁 {folderLabel(f)}</option>)}
            </GSel>
          )}
          {pageTab === "list" && (
            <GBtn variant="ghost" onClick={() => setFolderManagerOpen(true)} className="!py-1.5 !text-xs"><Filter size={12} className="inline mr-1.5" />Manage Folders</GBtn>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
          <GBtn variant="ghost" onClick={() => fileRef.current?.click()}><Download size={14} className="inline mr-1.5 rotate-180" />Import</GBtn>
          <GBtn variant="ghost" onClick={exportCSV}><Download size={14} className="inline mr-1.5" />Export</GBtn>
          <GBtn variant={mergeMode ? "danger" : "ghost"} onClick={() => { setMergeMode(!mergeMode); setMergePair([]); }}><UserCheck size={14} className="inline mr-1.5" />{mergeMode ? "Cancel Merge" : "Merge"}</GBtn>
          <GBtn variant={bulkMode ? "danger" : "ghost"} onClick={() => { setBulkMode(!bulkMode); setBulkSelected([]); }}><CheckSquare size={14} className="inline mr-1.5" />{bulkMode ? "Cancel Select" : "Select"}</GBtn>
          <GBtn onClick={() => setModal({ open: true, data: null })}><Plus size={14} className="inline mr-1.5" />Add</GBtn>
        </div>
      </div>

      {/* AUDIT FIX — drag-and-drop folder assignment. Drag a customer row
          from the list below onto one of these chips to move them into that
          folder; native HTML5 drag/drop, no library. Only shown when at
          least one folder exists so it doesn't clutter a fresh install. */}
      {pageTab === "list" && allFolderPaths.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-1">
          <span className="text-[10px] text-white/30 uppercase tracking-wider mr-1">Drag to file:</span>
          <div
            onDragOver={e => { e.preventDefault(); setDragOverFolder("__unfiled__"); }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={e => { e.preventDefault(); if (draggedCustomerId) moveCustomerToFolder(draggedCustomerId, ""); setDraggedCustomerId(null); setDragOverFolder(null); }}
            className={"text-[10px] px-2 py-1 rounded-full border transition " + (dragOverFolder === "__unfiled__" ? "bg-white/20 border-white/40" : "bg-white/5 border-white/10 text-white/40")}
          >
            Unfiled
          </div>
          {allFolderPaths.map(f => (
            <div
              key={f}
              onDragOver={e => { e.preventDefault(); setDragOverFolder(f); }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={e => { e.preventDefault(); if (draggedCustomerId) moveCustomerToFolder(draggedCustomerId, f); setDraggedCustomerId(null); setDragOverFolder(null); }}
              className={"text-[10px] px-2 py-1 rounded-full border transition " + (dragOverFolder === f ? "bg-blue-900/50 border-blue-500/60 text-blue-200" : "bg-blue-950/20 border-blue-700/30 text-blue-300/70")}
              style={{ marginLeft: folderDepth(f) * 8 }}
            >
              📁 {folderLabel(f)}
            </div>
          ))}
        </div>
      )}

      {bulkMode && pageTab === "list" && (
        <Glass className="p-3 !bg-red-950/15 !border-red-700/30 flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input type="checkbox" checked={filtered.length > 0 && bulkSelected.length === filtered.length} onChange={toggleBulkAll} className="w-4 h-4 rounded accent-red-600" />
            Select all ({bulkSelected.length}/{filtered.length})
          </label>
          {bulkSelected.length > 0 && (
            <div className="flex gap-2">
              <GBtn variant="ghost" onClick={downloadSelectedCsv} className="!text-xs"><Download size={12} className="inline mr-1" />Download ({bulkSelected.length})</GBtn>
              <GBtn variant="danger" onClick={deleteSelectedCustomers} className="!text-xs"><Trash2 size={12} className="inline mr-1" />Delete ({bulkSelected.length})</GBtn>
            </div>
          )}
        </Glass>
      )}

      {/* LTV Analytics tab */}
      {pageTab === "analytics" && <CustomerAnalytics customers={customers} jobs={jobs} estimates={estimates} />}

      {/* Duplicates tab */}
      {pageTab === "duplicates" && <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/60">{dupPairs === null ? "Click Scan to find duplicates" : dupPairs.length === 0 ? "✅ No duplicates found" : dupPairs.length + " potential duplicate" + (dupPairs.length !== 1 ? "s" : "") + " found"}</div>
          <GBtn onClick={scanDuplicates} className="!text-xs"><Search size={12} className="inline mr-1" />Rescan</GBtn>
        </div>
        {dupPairs?.length > 0 && <div className="space-y-3">
          {dupPairs.map((pair, i) => (
            <Glass key={i} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge tone="yellow">{pair.reason}</Badge>
                <div className="flex gap-2">
                  <GBtn onClick={() => openMerge(pair.a, pair.b)} className="!text-xs !py-1">Merge</GBtn>
                  <GBtn variant="ghost" onClick={() => setDupPairs(prev => prev.filter((_, j) => j !== i))} className="!text-xs !py-1">Not a dup</GBtn>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {[pair.a, pair.b].map((c, ci) => (
                  <div key={c.id} className={"p-3 rounded-xl border " + (ci === 0 ? "border-blue-700/40 bg-blue-950/20" : "border-purple-700/40 bg-purple-950/20")}>
                    <div className="font-bold">{c.firstName} {c.lastName}</div>
                    <div className="text-white/60 mt-1 space-y-0.5">
                      {c.phone && <div>📞 {c.phone}</div>}
                      {c.email && <div>📧 {c.email}</div>}
                      {c.address && <div>📍 {c.address.split(",")[0]}</div>}
                      <div className="text-white/40">LTV: {fmt(c.totalSpent || 0)} · Added {c.createdAt}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Glass>
          ))}
        </div>}
      </div>}

      {/* Merge modal */}
      {mergeModal && <Modal open={!!mergeModal} onClose={() => setMergeModal(null)} title="Merge Customers — Choose which info to keep" maxW="max-w-2xl">
        <div className="space-y-3">
          <div className="text-xs text-white/60 mb-2">Click each field to choose which version to keep. Combined LTV and tags are kept from both.</div>
          {[
            { key: "firstName", label: "First Name" }, { key: "lastName", label: "Last Name" },
            { key: "phone", label: "Phone" }, { key: "email", label: "Email" },
            { key: "address", label: "Address" }, { key: "leadSource", label: "Lead Source" },
            { key: "sqFootage", label: "Sq Footage" }, { key: "gateCode", label: "Gate Code" },
            { key: "notes", label: "Notes" }
          ].filter(f => mergeModal.a[f.key] || mergeModal.b[f.key]).map(f => (
            <div key={f.key} className="grid grid-cols-3 gap-2 items-center">
              <div className="text-[10px] text-white/50 uppercase tracking-wider">{f.label}</div>
              {["a","b"].map(side => {
                const c = mergeModal[side];
                const val = c[f.key];
                const active = mergeChoices[f.key] === side;
                return <button key={side} onClick={() => setMergeChoices(prev => ({ ...prev, [f.key]: side }))} className={"p-2.5 rounded-xl border text-left text-xs transition " + (active ? "border-green-500/60 bg-green-950/30 text-green-300" : "border-white/10 bg-black/40 text-white/50 hover:text-white hover:border-white/20") + (!val ? " opacity-30" : "")}>
                  {active && <span className="text-green-400 mr-1">✓</span>}{val || <span className="italic text-white/30">empty</span>}
                </button>;
              })}
            </div>
          ))}
          <div className="flex gap-2 justify-end pt-3 border-t border-red-900/20">
            <GBtn variant="ghost" onClick={() => setMergeModal(null)}>Cancel</GBtn>
            <GBtn onClick={doMerge}>Merge → Keep Selected Fields</GBtn>
          </div>
        </div>
      </Modal>}

      {/* AUDIT FIX — full folder management: create, rename, delete, and
          nested ("Parent/Child") organization. Drag-and-drop reassignment
          lives on the list view itself (chips above the table); this modal
          is for structural changes to the folders themselves. */}
      {folderManagerOpen && (
        <Modal open={folderManagerOpen} onClose={() => { setFolderManagerOpen(false); setRenamingFolder(null); }} title="Manage Folders">
          <div className="space-y-4 min-w-[320px]">
            <div className="flex gap-2">
              <GSel value={newFolderParent} onChange={e => setNewFolderParent(e.target.value)} className="!text-xs !w-36 flex-shrink-0">
                <option value="">Top level</option>
                {allFolderPaths.map(f => <option key={f} value={f}>{"—".repeat(folderDepth(f))} {folderLabel(f)}</option>)}
              </GSel>
              <input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createFolder()}
                placeholder="New folder name"
                className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
              />
              <GBtn onClick={createFolder} disabled={!newFolderName.trim()} className="!text-xs flex-shrink-0"><Plus size={12} className="inline mr-1" />Add</GBtn>
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {allFolderPaths.length === 0 && <div className="text-center text-xs text-white/40 py-6">No folders yet — add one above.</div>}
              {allFolderPaths.map(f => (
                <div key={f} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5" style={{ marginLeft: folderDepth(f) * 16 }}>
                  {renamingFolder === f ? (
                    <>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") renameFolder(f, renameValue); if (e.key === "Escape") setRenamingFolder(null); }}
                        className="flex-1 bg-black/60 border border-white/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                      />
                      <button onClick={() => renameFolder(f, renameValue)} className="text-[10px] px-2 py-1 rounded-lg bg-green-900/40 text-green-300 hover:bg-green-800/50">Save</button>
                      <button onClick={() => setRenamingFolder(null)} className="text-[10px] px-2 py-1 rounded-lg bg-white/10 text-white/50 hover:text-white">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs flex-1 min-w-0 truncate">📁 {folderLabel(f)} <span className="text-white/30">({folderCustomerCount(f)})</span></span>
                      <button onClick={() => { setRenamingFolder(f); setRenameValue(folderLabel(f)); }} className="p-1.5 text-white/40 hover:text-white flex-shrink-0" title="Rename"><Edit size={12} /></button>
                      <button onClick={() => deleteFolder(f)} className="p-1.5 text-white/40 hover:text-red-400 flex-shrink-0" title="Delete"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="text-[10px] text-white/30 pt-2 border-t border-white/10">Tip: pick a parent above to nest a folder inside another (e.g. "Commercial" → "Restaurants"). Deleting a folder unfiles its customers — it never deletes them.</div>
          </div>
        </Modal>
      )}

      {pageTab === "list" && <>
      {mergeMode && <Glass className="p-3 !bg-yellow-950/20 !border-yellow-700/40">
        <div className="flex items-center justify-between">
          <div className="text-sm text-yellow-300">Select 2 customers to merge ({mergePair.length}/2)</div>
          {mergePair.length === 2 && <GBtn onClick={doSimpleMerge} className="!py-1 !text-xs"><UserCheck size={12} className="inline mr-1" />Merge Now</GBtn>}
        </div>
      </Glass>}

      <Glass className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-red-900/30 bg-black/40">
                {mergeMode && <th className="px-4 py-3"></th>}
                {bulkMode && <th className="px-4 py-3"></th>}
                <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider hidden lg:table-cell">Phone</th>
                <th className="text-right px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Spent</th>
                <th className="text-right px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const sel = mergePair.includes(c.id);
                return (
                  <tr key={c.id}
                    draggable={!mergeMode && !bulkMode}
                    onDragStart={() => setDraggedCustomerId(c.id)}
                    onDragEnd={() => setDraggedCustomerId(null)}
                    className={"border-b border-red-900/10 hover:bg-white/5 transition " + (sel ? "bg-yellow-950/20" : "") + (draggedCustomerId === c.id ? " opacity-40" : "")}>
                    {mergeMode && <td className="px-4 py-4"><input type="checkbox" checked={sel} onChange={() => toggleMerge(c.id)} className="w-4 h-4 accent-red-600" /></td>}
                    {bulkMode && <td className="px-4 py-4"><input type="checkbox" checked={bulkSelected.includes(c.id)} onChange={() => toggleBulk(c.id)} className="w-4 h-4 rounded accent-red-600" /></td>}
                    <td className="px-5 py-4 cursor-pointer" onClick={() => !mergeMode && !bulkMode && setDetail(c)}>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{c.firstName} {c.lastName}</div>
                        {c.hasDog && <span title={"Dog: " + c.dogName} className="text-[10px]">🐕</span>}
                        {c.gateCode && <span title={"Gate: " + c.gateCode} className="text-[10px]">🔒</span>}
                        {c.folder && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-950/40 border border-blue-700/40 text-blue-300">📁 {c.folder}</span>}
                      </div>
                      <div className="text-xs text-white/50">{c.email}</div>
                    </td>
                    <td className="px-5 py-4 text-white/70 hidden lg:table-cell cursor-pointer" onClick={() => !mergeMode && !bulkMode && setDetail(c)}>{c.phone}</td>
                    <td className="px-5 py-4 text-right font-semibold text-red-400 cursor-pointer" onClick={() => !mergeMode && !bulkMode && setDetail(c)}>{fmt(c.totalSpent)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => quickAction("call", c)} className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/60 hover:text-green-400 transition"><Phone size={14} /></button>
                        <button onClick={() => quickAction("text", c)} className="p-1.5 rounded-lg hover:bg-blue-900/30 text-white/60 hover:text-blue-400 transition"><MessageSquare size={14} /></button>
                        <button onClick={() => window.open("https://maps.google.com/?q=" + encodeURIComponent(c.address || ""), "_blank")} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition" title="Directions"><MapPin size={14} /></button>
                        <button onClick={() => { const lastJob = jobs.filter(j => j.customerId === c.id && j.status === "completed").slice(-1)[0]; if (lastJob) { toast("Review request queued for " + c.firstName); } else { toast("No completed jobs for " + c.firstName, "error"); }}} className="p-1.5 rounded-lg hover:bg-yellow-900/30 text-white/60 hover:text-yellow-400 transition" title="Send review request"><Star size={14} /></button>
                        <button onClick={() => setModal({ open: true, data: c })} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"><Edit size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Glass>

      <CustomerModal open={modal.open} onClose={() => setModal({ open: false, data: null })} data={modal.data} onSave={save} mapsKey={settings.googleMapsKey || (settings as any).mapsKey || ""} customers={customers} />
      <CustomerDetail customer={detail} onClose={() => setDetail(null)} onDelete={deleteCustomer} onEdit={(cust: any) => { setDetail(null); setModal({ open: true, data: cust }); }} estimates={estimates} jobs={jobs} employees={employees} timeline={timeline} setTimeline={setTimeline} settings={settings} />
      </>}
    </div>
  );
}

// ===== CUSTOMER LTV ANALYTICS =====
