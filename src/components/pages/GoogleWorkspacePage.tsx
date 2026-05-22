import React, { useState } from "react";
import {
  Mail, Calendar, CheckSquare, Users, Cloud, Globe,
  Zap, ExternalLink, Activity,
} from "lucide-react";
import type { AppSettings } from "../../types";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { Badge } from "../ui/Badge";
import { supabase } from "../../lib/supabase";

// ─── Connect prompt ───────────────────────────────────────────────────────────
const ConnectPrompt = ({ onConnect, onNav }: { onConnect: () => void; onNav: (p: string) => void }) => (
  <Glass className="p-8 text-center space-y-4 !border-blue-700/30 !bg-blue-950/10">
    <div className="flex justify-center">
      <svg viewBox="0 0 48 48" width="40" height="40"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
    </div>
    <div>
      <div className="font-semibold text-white">Connect Google Account</div>
      <div className="text-sm text-white/50 mt-1">Sign in with Google to link your account. Gmail, Calendar, Tasks, and Drive data will be available once Edge Functions are deployed.</div>
    </div>
    <div className="grid grid-cols-3 gap-2 text-center text-xs text-white/50">
      {["📅 Calendar", "✅ Tasks", "🗺️ Maps", "📧 Gmail", "💾 Drive", "👥 Contacts"].map(s => (
        <div key={s} className="p-2 bg-black/40 border border-white/5 rounded-xl">{s}</div>
      ))}
    </div>
    <button
      onClick={onConnect}
      className="w-full flex items-center justify-center gap-3 py-3 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
    >
      <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
      Sign in with Google
    </button>
    <button onClick={() => onNav("settings")} className="text-xs text-white/40 hover:text-white/60 transition">
      Or configure manually in Settings → Integrations →
    </button>
  </Glass>
);

// ─── Edge Function placeholder ────────────────────────────────────────────────
const EdgeFnPlaceholder = ({ service, icon: Icon, description }: { service: string; icon: React.ComponentType<any>; description: string }) => (
  <Glass className="p-6 text-center space-y-3 !bg-black/40">
    <div className="flex justify-center">
      <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-700/30">
        <Icon size={22} className="text-blue-400" />
      </div>
    </div>
    <div>
      <div className="font-semibold text-white/80">{service} — Connected</div>
      <div className="text-xs text-white/50 mt-1 max-w-xs mx-auto">{description}</div>
    </div>
    <div className="flex items-center justify-center gap-2 text-xs text-yellow-400/80 bg-yellow-950/20 border border-yellow-700/20 rounded-xl p-2.5">
      <Zap size={12} />
      <span>Live data requires Supabase Edge Functions · Coming soon</span>
    </div>
  </Glass>
);

// ─── Main component ───────────────────────────────────────────────────────────
export function GoogleWorkspacePage({
  settings = {} as AppSettings,
  setSettings,
  googleData = {},
  setGoogleData,
  customers = [],
  setCustomers,
  jobs = [],
  toast,
  onNav,
}: {
  settings?: AppSettings;
  setSettings?: any;
  googleData?: any;
  setGoogleData?: any;
  customers?: any[];
  setCustomers?: any;
  jobs?: any[];
  toast?: any;
  onNav?: any;
}) {
  const [tab, setTab] = useState("overview");

  const isConnected = !!(settings as any).googleConnected;
  const googleEmail: string = (settings as any).googleEmail || "";

  const doConnect = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          queryParams: { access_type: "offline", prompt: "consent" },
          scopes: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/tasks",
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/contacts",
          ].join(" "),
          redirectTo: window.location.origin + window.location.pathname,
        },
      });
      if (error) toast?.("Google sign-in failed: " + error.message, "red");
    } catch (e: any) {
      toast?.("Google sign-in failed: " + e.message, "red");
    }
  };

  const doDisconnect = async () => {
    await supabase.auth.signOut();
    setSettings?.((prev: any) => ({
      ...prev,
      googleConnected: false,
      googleToken: "",
      googleRefreshToken: "",
      googleEmail: "",
      googleScopes: {},
    }));
    toast?.("Disconnected from Google", "green");
  };

  const tabs = [
    { k: "overview",  l: "Overview",  icon: Globe },
    { k: "gmail",     l: "Gmail",     icon: Mail },
    { k: "calendar",  l: "Calendar",  icon: Calendar },
    { k: "tasks",     l: "Tasks",     icon: CheckSquare },
    { k: "contacts",  l: "Contacts",  icon: Users },
    { k: "drive",     l: "Drive",     icon: Cloud },
  ];

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-red-500/20 border border-white/10">
            <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          </div>
          <div>
            <div className="font-bold">Google Workspace</div>
            <div className="text-[11px] text-red-400">Not connected</div>
          </div>
        </div>
        <ConnectPrompt onConnect={doConnect} onNav={onNav || (() => {})} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-green-500/20 border border-white/10">
            <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          </div>
          <div>
            <div className="font-bold">Google Workspace</div>
            <div className="text-[11px] text-green-400">✓ Connected as {googleEmail}</div>
          </div>
        </div>
        <GBtn variant="ghost" onClick={doDisconnect} className="!text-xs !text-red-400">Disconnect</GBtn>
      </div>

      {/* Active scopes */}
      <Glass className="p-3 !bg-black/40">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Authorized scopes</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "📅 Calendar", k: "calendar" },
            { label: "📧 Gmail",    k: "gmail"    },
            { label: "✅ Tasks",    k: "tasks"    },
            { label: "💾 Drive",    k: "drive"    },
            { label: "👥 Contacts", k: "contacts" },
          ].map(s => (
            <span key={s.k} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-green-950/30 border border-green-700/30 text-green-300">
              {s.label}
            </span>
          ))}
        </div>
      </Glass>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 flex-wrap">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition " + (tab === t.k ? "bg-blue-900/40 border-blue-500/50 text-white" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>
              <Icon size={12} />{t.l}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: Mail,        label: "Gmail",      desc: "Inbox & send" },
              { icon: Calendar,    label: "Calendar",   desc: "Events & scheduling" },
              { icon: CheckSquare, label: "Tasks",      desc: "Google Tasks" },
              { icon: Users,       label: "Contacts",   desc: "People API" },
              { icon: Cloud,       label: "Drive",      desc: "Files & storage" },
              { icon: Activity,    label: "Status",     desc: "Identity verified ✓" },
            ].map(s => (
              <Glass key={s.label} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon size={14} className="text-blue-400" />
                  <span className="text-[10px] text-white/50 uppercase tracking-wider">{s.label}</span>
                </div>
                <div className="text-sm font-medium text-white/70">{s.desc}</div>
              </Glass>
            ))}
          </div>

          <Glass className="p-4 !bg-yellow-950/10 !border-yellow-700/20">
            <div className="flex items-start gap-3">
              <Zap size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-sm text-white/90">Edge Functions Required for Live Data</div>
                <div className="text-xs text-white/60">
                  Your Google account is connected and identity verified. To read Gmail, Calendar events, Tasks, Contacts, and Drive files, deploy a Supabase Edge Function that uses the Google service account or OAuth token exchange. This keeps your credentials server-side and secure.
                </div>
                <div className="text-[11px] text-yellow-400/70 mt-2">
                  Calendar event sync (create/update/delete on job schedule) is already wired and will work once Edge Functions are active.
                </div>
              </div>
            </div>
          </Glass>
        </div>
      )}

      {/* ── GMAIL ── */}
      {tab === "gmail" && (
        <EdgeFnPlaceholder
          service="Gmail"
          icon={Mail}
          description="Read inbox, send emails, and mark messages read — requires a Supabase Edge Function to proxy Google Gmail API calls using your OAuth session."
        />
      )}

      {/* ── CALENDAR ── */}
      {tab === "calendar" && (
        <EdgeFnPlaceholder
          service="Google Calendar"
          icon={Calendar}
          description="View upcoming events, create new events, and sync job schedules — requires a Supabase Edge Function. Job scheduling already creates/updates/deletes calendar events via direct API when a token is available."
        />
      )}

      {/* ── TASKS ── */}
      {tab === "tasks" && (
        <EdgeFnPlaceholder
          service="Google Tasks"
          icon={CheckSquare}
          description="View and create tasks across all your Google Task lists — requires a Supabase Edge Function to proxy Google Tasks API calls."
        />
      )}

      {/* ── CONTACTS ── */}
      {tab === "contacts" && (
        <EdgeFnPlaceholder
          service="Google Contacts"
          icon={Users}
          description="Import Google contacts directly into the CRM — requires a Supabase Edge Function to proxy Google People API calls."
        />
      )}

      {/* ── DRIVE ── */}
      {tab === "drive" && (
        <EdgeFnPlaceholder
          service="Google Drive"
          icon={Cloud}
          description="Browse and open Drive files — requires a Supabase Edge Function to proxy Google Drive API calls."
        />
      )}
    </div>
  );
}
