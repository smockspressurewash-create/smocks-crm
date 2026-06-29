import { useState, useEffect } from "react";
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";

export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase sends recovery tokens as hash params: #access_token=...&type=recovery
  // We must call setSession with these tokens before updateUser will work.
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");

    if (type === "recovery" && access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error: err }) => {
        if (err) {
          setError("Recovery link is invalid or expired. Please request a new one.");
        } else {
          setSessionReady(true);
          // Clear token params from URL so they can't be replayed
          window.location.hash = "/reset-password";
        }
      });
    } else {
      // May already have a recovery session (e.g. page refreshed after setSession)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setSessionReady(true);
        else setError("No valid recovery session. Please use the link from your email.");
      });
    }
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSuccess(true);
    await supabase.auth.signOut();
    setTimeout(() => { window.location.hash = "/portal"; }, 2500);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-red-900/40">
            <Lock size={24} className="text-white" />
          </div>
          <div className="text-xl font-bold text-white">Reset Password</div>
          <div className="text-sm text-white/50 mt-1">Enter your new password below</div>
        </div>

        <Glass className="p-6 space-y-4">
          {success ? (
            <div className="text-center space-y-3 py-2">
              <CheckCircle size={36} className="text-green-400 mx-auto" />
              <div className="text-green-300 font-semibold">Password updated!</div>
              <div className="text-sm text-white/50">Redirecting to login…</div>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/40 border border-red-700/40 text-red-300 text-sm">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-white/50 font-medium">New Password</label>
                <div className="relative">
                  <GInput
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleSubmit()}
                    disabled={loading || !sessionReady}
                    className="!pr-11"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-white/40 hover:text-white/80">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/50 font-medium">Confirm Password</label>
                <GInput
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat new password"
                  value={confirm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleSubmit()}
                  disabled={loading || !sessionReady}
                />
              </div>

              <GBtn
                onClick={handleSubmit}
                disabled={loading || !sessionReady || !password || !confirm}
                className="w-full justify-center py-2.5"
              >
                {loading ? "Updating…" : "Update Password"}
              </GBtn>
            </>
          )}
        </Glass>
      </div>
    </div>
  );
}
