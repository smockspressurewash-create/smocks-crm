import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Glass, GBtn, GInput } from '../ui/Glass';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onSwitchToSignup: () => void;
  onSwitchToForgot: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignup, onSwitchToForgot }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-black">
      <Glass className="w-full max-w-md p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-red-600/20 rounded-2xl flex items-center justify-center mx-auto border border-red-500/30">
            <Lock className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-white/50 text-sm">Sign in to your Smock's CRM account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
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

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-medium text-white/70">Password</label>
              <button
                type="button"
                onClick={onSwitchToForgot}
                className="text-xs text-red-400 hover:text-red-300 transition"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
              <GInput
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
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
              'Sign In'
            )}
          </GBtn>
        </form>

        <div className="text-center pt-2">
          <p className="text-sm text-white/40">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToSignup}
              className="text-red-400 hover:text-red-300 font-medium transition"
            >
              Create one now
            </button>
          </p>
        </div>
      </Glass>
    </div>
  );
};
