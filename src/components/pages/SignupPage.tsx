import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Glass, GBtn, GInput } from '../ui/Glass';
import { UserPlus, Mail, Lock, User, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface SignupPageProps {
  onSwitchToLogin: () => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ onSwitchToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-black">
        <Glass className="w-full max-w-md p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto border border-green-500/30">
            <CheckCircle2 className="text-green-500" size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Check your email</h1>
            <p className="text-white/50 text-sm">
              We've sent a confirmation link to <span className="text-white font-medium">{email}</span>. 
              Please click the link to activate your account.
            </p>
          </div>
          <GBtn variant="ghost" onClick={onSwitchToLogin} className="w-full">
            Back to Login
          </GBtn>
        </Glass>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-black">
      <Glass className="w-full max-w-md p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-red-600/20 rounded-2xl flex items-center justify-center mx-auto border border-red-500/30">
            <UserPlus className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-white/50 text-sm">Start your free trial with Smock's CRM</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 ml-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
              <GInput
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e: any) => setFullName(e.target.value)}
                className="pl-12"
                required
              />
            </div>
          </div>

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
            <label className="text-sm font-medium text-white/70 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
              <GInput
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
                className="pl-12"
                required
                minLength={6}
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
              'Create Account'
            )}
          </GBtn>
        </form>

        <div className="text-center pt-2">
          <p className="text-sm text-white/40">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-red-400 hover:text-red-300 font-medium transition"
            >
              Sign In
            </button>
          </p>
        </div>
      </Glass>
    </div>
  );
};
