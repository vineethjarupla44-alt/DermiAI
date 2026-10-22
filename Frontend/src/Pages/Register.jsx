import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '../../firebase'
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import api from '../api'
import useStore from '../store/useStore'

export default function Register() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const setSession = useStore((s) => s.setSession)

  const syncWithBackend = async (token, userFallback) => {
    try {
      const response = await api.post(
        '/auth/google',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      setSession({
        token: token,
        user: response.data.user,
      })
    } catch (err) {
      console.warn('Backend auth sync notice:', err)
      setSession({
        token: token,
        user: userFallback || {
          email: auth.currentUser?.email || '',
          display_name: auth.currentUser?.displayName || 'User',
          photo_url: auth.currentUser?.photoURL || '',
        },
      })
    }
  }

  const handleEmailRegister = async (e) => {
    e.preventDefault()
    setError(null)

    if (!displayName.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(userCredential.user, { displayName: displayName.trim() })
      const token = await userCredential.user.getIdToken(true)

      await syncWithBackend(token, {
        email: userCredential.user.email,
        display_name: displayName.trim(),
      })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already in use. Please sign in instead.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else {
        setError(err.message || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const token = await result.user.getIdToken()
      await syncWithBackend(token, {
        email: result.user.email,
        display_name: result.user.displayName || 'User',
        photo_url: result.user.photoURL || '',
      })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Google Sign-In failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070c14] flex flex-col justify-between p-6 relative overflow-hidden font-sans select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top bar with Back button */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between relative z-10 pt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </div>

      {/* Register Card */}
      <div className="flex items-center justify-center py-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md rounded-3xl bg-[#0a1122] border border-[#172544] p-8 shadow-2xl backdrop-blur-xl text-center"
        >
          {/* Logo icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-400 to-sky-500 p-[1.5px] shadow-[0_0_20px_rgba(6,182,212,0.35)] mx-auto mb-5 flex items-center justify-center">
            <div className="w-full h-full bg-[#090e1c] rounded-[14px] flex items-center justify-center">
              <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Create an Account
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 mb-6">
            Join DermiAI to track your skin scans and monitor lesions over time.
          </p>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-left flex items-start gap-2">
              <span className="text-sm">⚠️</span>
              <span className="mt-0.5 leading-relaxed">{error}</span>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleEmailRegister} className="space-y-3.5 text-left mb-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Dr. Alex Rivera"
                className="w-full bg-[#070c14] border border-[#1a2642] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full bg-[#070c14] border border-[#1a2642] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#070c14] border border-[#1a2642] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 rounded-xl pl-4 pr-10 py-2.5 text-white placeholder-slate-600 text-sm outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#070c14] border border-[#1a2642] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gradient w-full py-3 rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center mb-5">
            <div className="flex-grow border-t border-[#172544]"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase tracking-widest text-slate-500">
              Or continue with
            </span>
            <div className="flex-grow border-t border-[#172544]"></div>
          </div>

          {/* Google Sign-in */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-[#111c33] hover:bg-[#162442] border border-[#1e2f55] text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors text-xs sm:text-sm disabled:opacity-60 shadow-md"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Navigation to Login */}
          <div className="mt-6 text-xs text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Footer disclaimer */}
      <div className="relative z-10 text-center text-[11px] text-slate-500 py-2">
        DermiAI is an educational AI research tool. Not for medical diagnosis.
      </div>
    </div>
  )
}
