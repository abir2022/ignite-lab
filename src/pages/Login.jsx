import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotQuestion, setForgotQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [newRequestedPassword, setNewRequestedPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: Answer & New Password
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Check if user is a teacher
      if (data?.user) {
        import('../lib/supabaseClient').then(({ supabase }) => {
          supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single()
            .then(({ data: profile }) => {
              if (profile?.role === 'teacher' || profile?.role === 'admin') {
                navigate('/teacher');
              } else {
                navigate('/dashboard');
              }
            });
        });
      } else {
        navigate('/dashboard');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  };

  const handleFetchQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const { data, error } = await import('../lib/supabaseClient').then(({ supabase }) => 
      supabase.from('profiles').select('secret_question').eq('email', forgotEmail).single()
    );

    if (error || !data) {
      setError("Could not find an account with that email.");
    } else {
      setForgotQuestion(data.secret_question);
      setForgotStep(2);
    }
    setLoading(false);
  };

  const handleSubmitForgotRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await import('../lib/supabaseClient').then(({ supabase }) => 
      supabase.from('password_requests').insert({
        user_email: forgotEmail,
        submitted_answer: forgotAnswer,
        requested_password: newRequestedPassword,
        status: 'pending'
      })
    );

    if (error) {
      setError(error.message);
    } else {
      alert("Request sent to Admin. Please wait for approval.");
      setShowForgot(false);
      setForgotStep(1);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-secondary/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="font-headline-lg text-4xl font-bold text-primary">DrilLab</Link>
          <p className="text-on-surface-variant font-body-md mt-2">Welcome back. Sign in to your lab workspace.</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 rounded-2xl border border-glass-border shadow-[0_8px_40px_rgba(0,104,119,0.1)]">
          
          {error && (
            <div className="bg-error-container text-on-error-container p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          {showForgot ? (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => { setShowForgot(false); setForgotStep(1); }} className="text-primary">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h3 className="font-bold text-on-surface">Forgot Password</h3>
              </div>

              {forgotStep === 1 ? (
                <form onSubmit={handleFetchQuestion} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Enter your Email</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <button type="submit" disabled={loading} className="ignition-gradient py-3 rounded-xl font-bold text-white">
                    {loading ? 'Checking...' : 'Next'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmitForgotRequest} className="flex flex-col gap-4">
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <p className="text-xs font-bold text-primary uppercase mb-1">Security Question</p>
                    <p className="text-on-surface font-medium">{forgotQuestion}</p>
                  </div>
                  <div>
                    <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">Your Answer</label>
                    <input
                      type="text"
                      value={forgotAnswer}
                      onChange={(e) => setForgotAnswer(e.target.value)}
                      required
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-on-surface-variant font-label-md text-label-md mb-1.5">New Desired Password</label>
                    <input
                      type="password"
                      value={newRequestedPassword}
                      onChange={(e) => setNewRequestedPassword(e.target.value)}
                      required
                      placeholder="Min. 6 characters"
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <button type="submit" disabled={loading} className="ignition-gradient py-3 rounded-xl font-bold text-white">
                    {loading ? 'Submitting...' : 'Send Request to Admin'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <>
              <form onSubmit={handleLogin} className="flex flex-col gap-5">
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
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-on-surface-variant font-label-md text-label-md">Password</label>
                    <button type="button" onClick={() => setShowForgot(true)} className="text-primary text-xs font-bold hover:underline">Forgot password?</button>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3.5 rounded-xl font-bold text-on-primary transition-all flex items-center justify-center gap-2 ${loading ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98]'}`}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Signing in...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">login</span>
                      Sign In
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-outline-variant"></div>
                <span className="text-outline text-xs uppercase tracking-widest font-bold">or</span>
                <div className="flex-1 h-px bg-outline-variant"></div>
              </div>

              {/* Google Auth */}
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface font-bold hover:bg-surface-variant active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              {/* Signup link */}
              <p className="text-center text-on-surface-variant text-sm mt-6">
                New to DrilLab?{' '}
                <Link to="/signup" className="text-primary font-bold hover:underline">Create an account</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
