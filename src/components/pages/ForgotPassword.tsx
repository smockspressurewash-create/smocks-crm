import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Glass, GBtn, GInput } from '../ui/Glass';
import { KeyRound, Mail, AlertCircle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-black">
      <Glass className="w-full max-w-md p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-red-600/20 rounded-2xl flex items-center justify-center mx-auto border border-red-500/30">
            <KeyRound className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          <p className="text-white/50 text-sm">We'll send you a link to get back into your account</p>
        </div>

        {success ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3 text-green-400 text-sm">
              <CheckCircle2 className="mt-0.5 flex-shrink-0" size={18} />
              <p>Check your email! We've sent a password reset link to <span className="text-white font-medium">{email}</span>.</p>
            </div>
            <GBtn variant="ghost" onClick={onBackToLogin} className="w-full flex items-center justify-center gap-2">
              <ArrowLeft size={16} />
              Back to Login
            </GBtn>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <GInput
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e: any) => setEmail(e.target.value)}
                  className="pl-12"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <GBtn
              type="submit"
              className="w-full py-3 h-12 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                'Send Reset Link'
              )}
            </GBtn>

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full text-center text-sm text-white/40 hover:text-white/60 transition flex items-center justify-center gap-2"
            >
              <ArrowLeft size={14} />
              Back to Login
            </button>
          </form>
        )}
      </Glass>
    </div>
  );
};
