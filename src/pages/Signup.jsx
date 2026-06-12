import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Signup = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secretQuestion, setSecretQuestion] = useState('What is your pet dog?');
  const [secretAnswer, setSecretAnswer] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, fullName, secretQuestion, secretAnswer);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md text-center">
          <div className="glass-card p-8 rounded-2xl border border-glass-border shadow-[0_8px_40px_rgba(0,104,119,0.1)]">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-primary text-4xl">check_circle</span>
            </div>
            <h2 className="font-headline-lg text-2xl text-on-surface mb-2">Check your email!</h2>
            <p className="text-on-surface-variant font-body-md mb-6">
              We've sent a confirmation link to <strong className="text-primary">{email}</strong>. Click the link to activate your lab workspace.
            </p>
            <Link to="/login" className="inline-block bg-primary text-on-primary px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-secondary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="font-headline-lg text-4xl font-bold text-primary">DrilLab</Link>
          <p className="text-on-surface-variant font-body-md mt-2">Student Registration. Join the lab and start learning.</p>
        </div>

        {/* Signup Card */}
        <div className="glass-card p-8 rounded-2xl border border-glass-border shadow-[0_8px_40px_rgba(0,104,119,0.1)]">
          
          {error && (
            <div className="bg-error-container text-on-error-container p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="flex flex-col gap-5">
            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Full Name</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">person</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Abir Hasan"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Email</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@drillab.org"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Confirm Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Security Question</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">help</span>
                <input
                  type="text"
                  value={secretQuestion}
                  onChange={(e) => setSecretQuestion(e.target.value)}
                  placeholder="e.g., What is your pet dog?"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Your Answer (For password reset)</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">verified_user</span>
                <input
                  type="text"
                  value={secretAnswer}
                  onChange={(e) => setSecretAnswer(e.target.value)}
                  placeholder="e.g., tommy"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-bold text-on-primary transition-all flex items-center justify-center gap-2 ${loading ? 'bg-primary/50 cursor-not-allowed' : 'ignition-gradient hover:shadow-lg hover:shadow-secondary/20 active:scale-[0.98]'}`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating account...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                  Launch My Student Lab
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-on-surface-variant mt-4 italic">
            Note: Teacher accounts can only be created by the platform Administrator.
          </p>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-outline-variant"></div>
            <span className="text-outline text-xs uppercase tracking-widest font-bold">or</span>
            <div className="flex-1 h-px bg-outline-variant"></div>
          </div>

          {/* Google Auth */}
          <button
            onClick={handleGoogleSignup}
            className="w-full py-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface font-bold hover:bg-surface-variant active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </button>

          {/* Login link */}
          <p className="text-center text-on-surface-variant text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
