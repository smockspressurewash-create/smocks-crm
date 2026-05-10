import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Glass, GBtn, GInput } from '../ui/Glass';
import { Lock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface ResetPasswordProps {
  onSuccess: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
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
            <h1 className="text-2xl font-bold text-white">Password Updated</h1>
            <p className="text-white/50 text-sm">
              Your password has been reset successfully. You can now sign in with your new credentials.
            </p>
          </div>
          <GBtn onClick={onSuccess} className="w-full">
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
            <Lock className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Set New Password</h1>
          <p className="text-white/50 text-sm">Please enter your new password below</p>
        </div>

        <form onSubmit={handleReset} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 ml-1">New Password</label>
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 ml-1">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
              <GInput
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e: any) => setConfirmPassword(e.target.value)}
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
              'Reset Password'
            )}
          </GBtn>
        </form>
      </Glass>
    </div>
  );
};
