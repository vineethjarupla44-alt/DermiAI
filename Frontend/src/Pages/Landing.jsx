import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

export default function Landing() {
  const navigate = useNavigate()
  const user = useStore((state) => state.user)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard')
    } else {
      navigate('/login')
    }
  }

  const handleScrollTo = (id) => {
    setMobileMenuOpen(false)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen bg-[#07111F] text-slate-100 flex flex-col font-sans selection:bg-[#22D3DD]/30 selection:text-[#22D3DD] overflow-x-hidden">
      {/* ── AMBIENT MEDICAL GLOW BACKGROUND ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/4 w-[650px] h-[650px] bg-[#22D3DD]/10 rounded-full blur-[150px]" />
        <div className="absolute top-1/3 right-4 w-[550px] h-[550px] bg-indigo-600/8 rounded-full blur-[160px]" />
        <div className="absolute bottom-10 left-1/3 w-[600px] h-[600px] bg-teal-500/6 rounded-full blur-[170px]" />
      </div>

      {/* ── HEADER NAVIGATION ── */}
      <header className="relative z-40 h-20 border-b border-[#142338]/80 backdrop-blur-md bg-[#07111F]/80 sticky top-0">
        <div className="max-w-7xl mx-auto h-full px-6 sm:px-10 flex items-center justify-between">
          {/* Logo & Subtitle */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            {/* Reticle Scanner Icon Container */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#22D3DD] to-sky-500 p-[1.5px] shadow-[0_0_20px_rgba(34,211,221,0.35)] flex items-center justify-center">
              <div className="w-full h-full bg-[#0a182b] rounded-[10px] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#22D3DD] group-hover:scale-105 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m16-6h-4a2 2 0 012 2v4M3 15v4a2 2 0 002 2h4m12-6v4a2 2 0 01-2 2h-4M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
                </svg>
              </div>
            </div>

            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight leading-none group-hover:text-cyan-200 transition-colors">
                DermiAI
              </h1>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide mt-1">
                AI for Skin Health
              </p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <button
              onClick={() => handleScrollTo('features')}
              className="hover:text-[#22D3DD] transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => handleScrollTo('how-it-works')}
              className="hover:text-[#22D3DD] transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => handleScrollTo('about')}
              className="hover:text-[#22D3DD] transition-colors"
            >
              About
            </button>
          </nav>

          {/* Right Action: Sign In or Dashboard */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gradient-to-r from-[#22D3DD] to-sky-500 text-[#07111F] font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 hover:opacity-95 shadow-md shadow-[#22D3DD]/20 transition-all"
              >
                <span>Dashboard</span>
                <span>&rarr;</span>
              </button>
            ) : (
              <button
                id="nav-signin-btn"
                onClick={() => navigate('/login')}
                className="text-sm font-semibold text-slate-200 hover:text-[#22D3DD] transition-colors px-3 py-1.5"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#0a182b] border-b border-[#142338] px-6 py-4 space-y-3"
            >
              <button
                onClick={() => handleScrollTo('features')}
                className="block w-full text-left py-2 text-sm text-slate-300 hover:text-[#22D3DD]"
              >
                Features
              </button>
              <button
                onClick={() => handleScrollTo('how-it-works')}
                className="block w-full text-left py-2 text-sm text-slate-300 hover:text-[#22D3DD]"
              >
                How It Works
              </button>
              <button
                onClick={() => handleScrollTo('about')}
                className="block w-full text-left py-2 text-sm text-slate-300 hover:text-[#22D3DD]"
              >
                About
              </button>
              <div className="pt-2 border-t border-[#172b45]">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleGetStarted()
                  }}
                  className="w-full text-center py-2.5 rounded-xl bg-[#22D3DD] text-[#07111F] font-bold text-sm shadow-md"
                >
                  {user ? 'Go to Dashboard' : 'Sign In'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── MAIN BODY ── */}
      <main className="relative z-10 flex-1">
        {/* ── HERO SECTION (BALANCED TWO-COLUMN) ── */}
        <section className="px-6 sm:px-10 pt-12 pb-16 lg:py-24 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            {/* LEFT COLUMN */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7 space-y-6"
            >
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#10243d]/80 border border-[#22D3DD]/30 text-[#22D3DD] text-xs font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(34,211,221,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22D3DD] animate-pulse" />
                AI-POWERED SKIN HEALTH
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold text-white tracking-tight leading-[1.12]">
                Understand Your Skin. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22D3DD] via-teal-300 to-sky-400">
                  Take Control of Your Health.
                </span>
              </h1>

              {/* Supporting description */}
              <p className="text-slate-300 text-base sm:text-lg max-w-xl leading-relaxed font-normal">
                Explore AI-assisted skin analysis with visual explanations designed to help you better understand your skin.
              </p>

              {/* Two CTA Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  id="hero-get-started-btn"
                  onClick={handleGetStarted}
                  className="bg-[#22D3DD] hover:bg-[#1fbfc8] text-[#07111F] font-bold px-7 py-3 rounded-xl text-sm sm:text-base shadow-lg shadow-[#22D3DD]/25 flex items-center gap-2 group transition-all"
                >
                  <span>Get Started</span>
                  <span className="group-hover:translate-x-1 transition-transform font-bold">&rarr;</span>
                </button>

                <button
                  onClick={() => handleScrollTo('features')}
                  className="bg-[#101F31]/70 hover:bg-[#152a42] border border-[#1e3452] hover:border-[#22D3DD]/50 text-slate-200 hover:text-white font-medium px-6 py-3 rounded-xl text-sm sm:text-base transition-all"
                >
                  Explore Features
                </button>
              </div>
            </motion.div>

            {/* RIGHT COLUMN — PREMIUM MEDICAL AI VISUAL */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="lg:col-span-5 flex justify-center lg:justify-end"
            >
              <div className="relative w-72 h-72 sm:w-88 sm:h-88 lg:w-96 lg:h-96 flex items-center justify-center">
                {/* Outer concentric scanning rings */}
                <div
                  className="absolute inset-0 rounded-full border border-[#22D3DD]/20 animate-spin"
                  style={{ animationDuration: '40s' }}
                />
                <div
                  className="absolute inset-5 rounded-full border border-dashed border-[#22D3DD]/30 animate-spin"
                  style={{ animationDuration: '28s', animationDirection: 'reverse' }}
                />
                <div className="absolute inset-12 rounded-full border border-sky-400/25" />

                {/* Central Glowing Scanner Pod */}
                <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-gradient-to-tr from-[#0a182b] via-[#101F31] to-[#0c1f38] p-1.5 border border-[#22D3DD]/40 shadow-[0_0_45px_rgba(34,211,221,0.25)] relative flex items-center justify-center overflow-hidden">
                  {/* Subtle Grid Lines */}
                  <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#22D3DD" strokeWidth="0.5" strokeDasharray="3 3" />
                    <line x1="50" y1="0" x2="50" y2="100" stroke="#22D3DD" strokeWidth="0.4" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#22D3DD" strokeWidth="0.4" />
                  </svg>

                  {/* 3D-Style Human Head Silhouette with Cybernetic Medical Lines */}
                  <svg className="w-40 h-40 text-[#22D3DD]/90 drop-shadow-[0_0_15px_rgba(34,211,221,0.65)]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3} d="M12 2C8 2 6 5 6 9c0 2.5 1 4.5 2 6 1 1.5 1.5 3 1.5 5h5c0-2 .5-3.5 1.5-5 1-1.5 2-3.5 2-6 0-4-2-7-6-7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 10c1 0 1.5-.5 1.5-1M15 10c-1 0-1.5-.5-1.5-1M12 12v2m-1 2h2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8} strokeDasharray="1 1.5" d="M8 7c2-1 6-1 8 0M7 11c1.5 1 2.5 2 3 4M17 11c-1.5 1-2.5 2-3 4" />
                  </svg>

                  {/* Dermatology Target Reticle Box Overlay (Cheek Area) */}
                  <div className="absolute bottom-8 right-8 w-24 h-24 rounded-2xl border border-[#22D3DD] bg-[#07111F]/90 p-1.5 shadow-[0_0_25px_rgba(34,211,221,0.5)] backdrop-blur-md flex flex-col justify-between">
                    <div className="flex justify-between items-center text-[9px] text-[#22D3DD] font-mono font-bold">
                      <span>SCAN</span>
                      <span className="w-2 h-2 rounded-full bg-[#22D3DD] animate-ping" />
                    </div>
                    {/* Lesion preview */}
                    <div className="w-full h-12 rounded-lg overflow-hidden border border-[#22D3DD]/40 bg-black">
                      <img src="/samples/hist_nv.jpg" alt="scanner" className="w-full h-full object-cover" />
                    </div>
                    <div className="text-[9px] text-[#22D3DD] font-mono text-center font-bold">
                      AI: 94.2%
                    </div>
                  </div>
                </div>

                {/* Floating Medical AI Panel 1: Top Left */}
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                  className="absolute -top-3 -left-3 sm:left-0 bg-[#101F31]/95 border border-[#22D3DD]/30 px-3.5 py-1.5 rounded-xl shadow-lg backdrop-blur-md text-[11px] font-semibold text-[#22D3DD] flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-[#22D3DD]" />
                  Grad-CAM Heatmap
                </motion.div>

                {/* Floating Medical AI Panel 2: Bottom Left */}
                <motion.div
                  animate={{ y: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
                  className="absolute -bottom-4 left-2 sm:left-6 bg-[#101F31]/95 border border-sky-400/30 px-3.5 py-1.5 rounded-xl shadow-lg backdrop-blur-md text-[11px] font-semibold text-sky-300 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  7 Skin Conditions
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── TRUSTED PRODUCT CAPABILITIES STRIP ── */}
        <section className="px-6 sm:px-10 pb-12 max-w-7xl mx-auto">
          <div className="rounded-2xl bg-[#101F31]/80 border border-[#17283c] p-4 sm:p-5 shadow-xl backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-[#17283c]">
              <div className="flex items-center gap-3.5 px-3 py-1">
                <div className="w-8 h-8 rounded-lg bg-[#22D3DD]/10 border border-[#22D3DD]/25 text-[#22D3DD] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">AI-Assisted Analysis</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">7 HAM10000 skin lesion classes</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 px-3 py-1 pt-3 md:pt-1">
                <div className="w-8 h-8 rounded-lg bg-[#22D3DD]/10 border border-[#22D3DD]/25 text-[#22D3DD] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">Visual Explainability</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Grad-CAM and Saliency maps</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 px-3 py-1 pt-3 md:pt-1">
                <div className="w-8 h-8 rounded-lg bg-[#22D3DD]/10 border border-[#22D3DD]/25 text-[#22D3DD] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">Personalized Scan History</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Track and review past analyses</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── THREE REFINED FEATURE CARDS ── */}
        <section id="features" className="px-6 sm:px-10 py-12 max-w-7xl mx-auto border-t border-[#142338]/60">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Clinical AI Capabilities
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Designed to make skin lesion analysis intuitive, transparent, and accessible.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: AI Analysis */}
            <div className="rounded-2xl bg-[#101F31] border border-[#1c2e47] p-6 shadow-xl hover:border-[#22D3DD]/50 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#22D3DD]/10 border border-[#22D3DD]/30 text-[#22D3DD] flex items-center justify-center mb-5 group-hover:shadow-[0_0_15px_rgba(34,211,221,0.3)] transition-all">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 3.104A7.5 7.5 0 0112 3c4.142 0 7.5 3.358 7.5 7.5a7.5 7.5 0 01-7.5 7.5 7.5 7.5 0 01-7.5-7.5c0-2.19.94-4.163 2.44-5.547" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 12l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-cyan-200 transition-colors">
                  AI Analysis
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  AI-assisted skin image predictions. Evaluates skin lesions across 7 distinct dermatological condition classes.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#17283c] text-xs font-semibold text-[#22D3DD]">
                EfficientNetV2 Architecture &rarr;
              </div>
            </div>

            {/* Card 2: Explainable AI */}
            <div className="rounded-2xl bg-[#101F31] border border-[#1c2e47] p-6 shadow-xl hover:border-[#22D3DD]/50 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#22D3DD]/10 border border-[#22D3DD]/30 text-[#22D3DD] flex items-center justify-center mb-5 group-hover:shadow-[0_0_15px_rgba(34,211,221,0.3)] transition-all">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-cyan-200 transition-colors">
                  Explainable AI
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Explore Grad-CAM and saliency visualizations when available to view the exact visual features guiding the prediction.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#17283c] text-xs font-semibold text-[#22D3DD]">
                Visual Interpretability &rarr;
              </div>
            </div>

            {/* Card 3: Secure Access */}
            <div className="rounded-2xl bg-[#101F31] border border-[#1c2e47] p-6 shadow-xl hover:border-[#22D3DD]/50 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#22D3DD]/10 border border-[#22D3DD]/30 text-[#22D3DD] flex items-center justify-center mb-5 group-hover:shadow-[0_0_15px_rgba(34,211,221,0.3)] transition-all">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-cyan-200 transition-colors">
                  Secure Access
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Access your account and scan history. Store historical scans in private database sessions with instant deletion control.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#17283c] text-xs font-semibold text-[#22D3DD]">
                Private & Local Storage &rarr;
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS SECTION (YOUR SKIN ANALYSIS JOURNEY) ── */}
        <section id="how-it-works" className="px-6 sm:px-10 py-16 max-w-7xl mx-auto border-t border-[#142338]/60">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Your Skin Analysis Journey
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Three seamless steps from image upload to clinical insight.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Step 1 */}
            <div className="rounded-2xl bg-[#101F31] border border-[#1c2e47] p-6 shadow-xl relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-[#22D3DD] font-mono">01</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#07111F] px-2.5 py-1 rounded-md border border-[#17283c]">
                    Input
                  </span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Upload an Image
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Choose a suitable close-up image of the affected skin area using file upload or your device camera.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl bg-[#101F31] border border-[#1c2e47] p-6 shadow-xl relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-[#22D3DD] font-mono">02</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#07111F] px-2.5 py-1 rounded-md border border-[#17283c]">
                    Inference
                  </span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  AI Analysis
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  The existing AI model processes the image, validates lesion suitability, and generates its prediction.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl bg-[#101F31] border border-[#1c2e47] p-6 shadow-xl relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-[#22D3DD] font-mono">03</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#07111F] px-2.5 py-1 rounded-md border border-[#17283c]">
                    Insights
                  </span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Explore Results
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Review the available prediction, visual explanations, and educational information on your condition.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── ABOUT / EDUCATIONAL PURPOSE BANNER ── */}
        <section id="about" className="px-6 sm:px-10 pb-16 max-w-7xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-r from-[#101F31] to-[#0d1a2b] border border-[#1c2e47] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-[#22D3DD]/10 border border-[#22D3DD]/30 text-[#22D3DD] flex items-center justify-center text-xl shrink-0 mt-0.5">
                ⓘ
              </div>
              <div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  Educational Purpose Only
                </h4>
                <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed max-w-2xl">
                  DermiAI provides AI-based analysis for educational and informational purposes only. It is not a medical diagnosis. Always consult a qualified dermatologist for professional medical advice.
                </p>
              </div>
            </div>

            <button
              onClick={handleGetStarted}
              className="bg-[#22D3DD] hover:bg-[#1fbfc8] text-[#07111F] font-bold px-6 py-3 rounded-xl text-xs sm:text-sm whitespace-nowrap shadow-md shadow-[#22D3DD]/20 transition-all shrink-0"
            >
              Get Started Now &rarr;
            </button>
          </div>
        </section>
      </main>

      {/* ── PREMIUM FOOTER ── */}
      <footer className="relative z-10 border-t border-[#142338] bg-[#07111F] px-6 sm:px-10 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#22D3DD]/20 text-[#22D3DD] flex items-center justify-center font-bold">
              D
            </div>
            <div>
              <span className="font-bold text-white text-sm">DermiAI</span>
              <p className="text-[11px] text-slate-500">AI-assisted skin health insights.</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => handleScrollTo('features')} className="hover:text-[#22D3DD] transition-colors">
              Features
            </button>
            <button onClick={() => handleScrollTo('how-it-works')} className="hover:text-[#22D3DD] transition-colors">
              How It Works
            </button>
            <button onClick={() => handleScrollTo('about')} className="hover:text-[#22D3DD] transition-colors">
              About
            </button>
            <button onClick={() => navigate('/login')} className="hover:text-[#22D3DD] transition-colors">
              Sign In
            </button>
          </div>

          <p className="text-center md:text-right text-slate-500">
            &copy; {new Date().getFullYear()} DermiAI. All rights reserved. For educational use.
          </p>
        </div>
      </footer>
    </div>
  )
}
