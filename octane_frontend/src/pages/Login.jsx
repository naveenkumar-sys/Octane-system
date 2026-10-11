import React, { useState } from 'react';
import { Zap, Lock, User, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBusinessProfile } from '../context/BusinessProfileContext';
import loginIllustration from '../assets/login_illustration.png';

export const Login = () => {
  const { login } = useAuth();
  const { businessProfile } = useBusinessProfile();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      console.error('Login failed:', err);
      const rawMsg = err.message || '';
      if (
        rawMsg.toLowerCase().includes('no active account') ||
        rawMsg.toLowerCase().includes('credentials') ||
        rawMsg.toLowerCase().includes('unauthorized') ||
        rawMsg.toLowerCase().includes('401')
      ) {
        setError('Incorrect username or password. Please verify your credentials and try again.');
      } else {
        setError(rawMsg || 'Invalid username or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 lg:bg-none lg:bg-slate-50 text-slate-900 flex flex-col lg:flex-row font-sans selection:bg-blue-600 selection:text-white select-none overflow-x-hidden">
      {/* LEFT HALF (Desktop Only): Illustration & Brand Highlights */}
      <div className="hidden lg:flex w-full lg:w-1/2 flex-col items-center justify-center p-8 lg:p-12 bg-white relative">
        <div className="max-w-lg w-full flex flex-col items-center text-center space-y-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center p-1.5 overflow-hidden flex-shrink-0">
              {businessProfile?.logo_url ? (
                <img
                  src={businessProfile.logo_url}
                  alt={businessProfile.company_name || 'Store Logo'}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-xs">
                  <Zap size={26} className="fill-current text-white" />
                </div>
              )}
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
                {businessProfile?.company_name || (
                  <>OCTANE<span className="text-orange-600">.SYSTEMS</span></>
                )}
              </h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                {businessProfile?.city ? `${businessProfile.city} • Enterprise ERP & POS` : 'Enterprise ERP & POS'}
              </p>
            </div>
          </div>

          {/* POS & ERP Graphic Illustration */}
          <div className="w-full max-w-sm py-4 relative">
            <img
              src={loginIllustration}
              alt="Octane ERP & POS Illustration"
              className="w-full h-auto object-contain drop-shadow-md rounded-2xl"
            />
          </div>

          {/* Key Feature Badges */}
          <div className="grid grid-cols-2 gap-3 w-full text-left pt-2">
            <div className="p-3 rounded-xl bg-orange-50/80 border border-orange-200/60 flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-orange-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-800">GST Compliant</p>
                <p className="text-[10px] text-slate-500">CGST/SGST/IGST Invoice Engine</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-orange-50/80 border border-orange-200/60 flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-orange-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-800">Stock Concurrency</p>
                <p className="text-[10px] text-slate-500">Real-time Serial & Inventory</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT HALF / MOBILE MAIN: Vibrant Orange Container with Login Card */}
      <div className="w-full lg:w-1/2 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative min-h-screen lg:min-h-[550px] lg:bg-gradient-to-br lg:from-orange-500 lg:via-orange-600 lg:to-amber-600 lg:rounded-l-3xl shadow-2xl overflow-hidden">
        {/* Decorative Background Curves */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full border-[24px] border-white" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full border-[32px] border-white" />
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/10 blur-2xl" />
        </div>

        {/* Elevated White Login Card */}
        <div className="relative z-10 w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl border border-orange-100 my-auto">
          {/* Card Header with Mobile Brand Logo */}
          <div className="mb-6 sm:mb-8 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2.5 mb-4 lg:hidden">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1 overflow-hidden flex-shrink-0">
                {businessProfile?.logo_url ? (
                  <img
                    src={businessProfile.logo_url}
                    alt={businessProfile.company_name || 'Store Logo'}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white">
                    <Zap size={20} className="fill-current text-white" />
                  </div>
                )}
              </div>
              <span className="text-xl font-extrabold text-slate-900 font-sans tracking-tight">
                {businessProfile?.company_name || (
                  <>OCTANE<span className="text-orange-600">.SYSTEMS</span></>
                )}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Hello!</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-1">Sign In to Get Started</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in font-semibold">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Username Pill Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 ml-1">
                Username <span className="text-orange-600">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all font-medium"
                  required
                />
              </div>
            </div>

            {/* Password Pill Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 ml-1">
                Password <span className="text-orange-600">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-2.5 sm:py-3 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Primary Orange Gradient Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-3.5 px-6 rounded-full bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-sm shadow-lg shadow-orange-500/30 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
