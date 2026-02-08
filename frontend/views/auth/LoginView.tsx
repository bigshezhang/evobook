/**
 * Login / Sign-up page for EvoBook.
 *
 * Supports toggling between "Sign In" and "Sign Up" modes. On success the
 * user is redirected to the main app.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useThemeColor, PAGE_THEME_COLORS } from '../../utils/themeColor';

type AuthMode = 'signin' | 'signup';

const LoginView: React.FC = () => {
  const navigate = useNavigate();
  // 设置页面主题色（状态栏颜色）
  useThemeColor(PAGE_THEME_COLORS.WHITE);

  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setSignUpSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSignUpSuccess(false);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        // Supabase returns fake success for existing emails (empty identities)
        if (!data.user?.identities?.length) {
          setError('An account with this email already exists. Please sign in instead.');
          return;
        }
        // If email confirmation is disabled, session is available immediately — redirect
        if (data.session) {
          // New signup always goes through onboarding
          navigate('/', { replace: true });
          return;
        }
        // Fallback: email confirmation is enabled, show prompt
        setSignUpSuccess(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        // Redirect to root, which will intelligently route based on user state
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-indigo-50 rounded-full blur-[80px] pointer-events-none opacity-60" />
      <div className="absolute bottom-[-5%] right-[-10%] w-48 h-48 bg-violet-50 rounded-full blur-[60px] pointer-events-none opacity-50" />

      {/* ── Top branding ───────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-10 pt-10">
        <div className="relative w-40 h-40 flex items-center justify-center mb-2">
          <div className="absolute inset-0 bg-indigo-50 rounded-full scale-110 blur-2xl opacity-50" />
          <div className="relative z-10 text-indigo-500">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '100px', fontVariationSettings: "'FILL' 1" }}
            >
              face_6
            </span>
          </div>
        </div>
        <h1 className="text-4xl font-black text-black tracking-tighter mb-1">EvoBook</h1>
        <p className="text-base text-gray-400 font-medium">
          {mode === 'signin' ? 'Welcome back!' : 'Create your account'}
        </p>
      </div>

      {/* ── Form ───────────────────────────────────── */}
      <div className="px-8 pb-12">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-600 mb-1.5 ml-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-14 px-5 rounded-input bg-background-light text-primary text-base font-medium placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-secondary/40 transition-all input-shadow"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-600 mb-1.5 ml-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-14 px-5 rounded-input bg-background-light text-primary text-base font-medium placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-secondary/40 transition-all input-shadow"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-50 text-red-600 text-sm font-medium">
              <span className="material-symbols-outlined text-lg mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                error
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Sign-up success message */}
          {signUpSuccess && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-green-50 text-green-700 text-sm font-medium">
              <span className="material-symbols-outlined text-lg mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <span>Account created! Check your email to confirm, then sign in.</span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-16 mt-2 rounded-full bg-black text-white font-extrabold text-lg active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
          >
            {loading ? (
              <span className="inline-block w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
            ) : mode === 'signin' ? (
              <>
                Sign In
                <span className="material-symbols-outlined text-2xl">arrow_forward</span>
              </>
            ) : (
              <>
                Sign Up
                <span className="material-symbols-outlined text-2xl">person_add</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle link */}
        <p className="text-center text-sm text-gray-400 mt-6">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <button onClick={toggleMode} className="text-secondary font-bold hover:underline">
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={toggleMode} className="text-secondary font-bold hover:underline">
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default LoginView;
