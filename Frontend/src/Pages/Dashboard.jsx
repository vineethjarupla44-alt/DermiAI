import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import api, { assetUrl } from '../api'
import useStore from '../store/useStore'

// Fallback demo cards matching the reference screenshot when user has no scans yet
const DEMO_SCANS = [
  {
    id: 'demo-1',
    image: '/samples/hist_nv.jpg',
    prediction: 'Melanocytic nevus',
    dotColor: 'bg-teal-400',
    confidence: 86,
    date: '22 Oct 2026, 6:12 PM',
    risk_level: 'Benign',
    prediction_code: 'nv',
  },
  {
    id: 'demo-2',
    image: '/samples/hist_bcc.jpg',
    prediction: 'Basal cell carcinoma',
    dotColor: 'bg-rose-400',
    confidence: 74,
    date: '20 Oct 2026, 3:40 PM',
    risk_level: 'Malignant',
    prediction_code: 'bcc',
  },
  {
    id: 'demo-3',
    image: '/samples/hist_akiec.jpg',
    prediction: 'Actinic keratosis',
    dotColor: 'bg-sky-400',
    confidence: 68,
    date: '18 Oct 2026, 11:20 AM',
    risk_level: 'Precancerous',
    prediction_code: 'akiec',
  },
  {
    id: 'demo-4',
    image: '/samples/hist_bkl.jpg',
    prediction: 'Benign keratosis',
    dotColor: 'bg-emerald-400',
    confidence: 81,
    date: '15 Oct 2026, 5:05 PM',
    risk_level: 'Benign',
    prediction_code: 'bkl',
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [recentScans, setRecentScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const token = useStore((s) => s.token)
  const user = useStore((s) => s.user)

  useEffect(() => {
    let mounted = true
    async function loadHistory() {
      setLoading(true)
      try {
        if (token) {
          const res = await api.get('/history')
          if (mounted) {
            const sorted = [...res.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            setRecentScans(sorted)
          }
        } else {
          if (mounted) setRecentScans([])
        }
      } catch (_err) {
        if (mounted) setRecentScans([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadHistory()
    return () => {
      mounted = false
    }
  }, [token])

  // Get color dot based on disease
  const getDiseaseDotColor = (code = '', prediction = '') => {
    const text = (code + ' ' + prediction).toLowerCase()
    if (text.includes('mel') || text.includes('bcc') || text.includes('carcinoma')) return 'bg-rose-400'
    if (text.includes('akiec') || text.includes('actinic')) return 'bg-sky-400'
    if (text.includes('bkl') || text.includes('benign')) return 'bg-emerald-400'
    if (text.includes('df') || text.includes('fibroma')) return 'bg-amber-400'
    if (text.includes('vasc')) return 'bg-purple-400'
    return 'bg-teal-400'
  }

  // Format scan items to display
  const displayScans = recentScans.length > 0
    ? recentScans.slice(0, 4).map((scan) => ({
        id: scan.id,
        image: scan.original_url ? assetUrl(scan.original_url) : '/samples/hist_nv.jpg',
        prediction: scan.prediction,
        dotColor: getDiseaseDotColor(scan.prediction_code, scan.prediction),
        confidence: Math.round(scan.confidence || 0),
        date: new Date(scan.created_at).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        isReal: true,
        raw: scan,
      }))
    : DEMO_SCANS

  const handleDeleteScan = async (e, scanId) => {
    e.stopPropagation()
    if (!token) return
    try {
      await api.delete(`/history/${scanId}`)
      setRecentScans((prev) => prev.filter((s) => s.id !== scanId))
    } catch (err) {
      console.error('Failed to delete scan:', err)
    }
  }

  return (
    <AppShell
      showSearch={true}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="space-y-8">
        {/* HERO SECTION */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#0c162c] via-[#091122] to-[#070c17] border border-[#172544] p-6 sm:p-10 overflow-hidden shadow-2xl">
          {/* Subtle cyan glow behind hero */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left text */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-white tracking-tight leading-[1.15]">
                  Understand your <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-sky-300">
                    skin with AI
                  </span>
                </h1>
                <p className="mt-3.5 text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
                  Upload a clear image of a skin lesion and get an AI-powered analysis with visual explanations and educational insights.
                </p>
              </div>

              {/* 3 Feature Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {/* Badge 1 */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#0e182f]/80 border border-[#1c2c4d]">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">AI Analysis</h4>
                    <p className="text-[11px] text-slate-400">7 skin conditions</p>
                  </div>
                </div>

                {/* Badge 2 */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#0e182f]/80 border border-[#1c2c4d]">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Explainable AI</h4>
                    <p className="text-[11px] text-slate-400">Grad-CAM & Saliency</p>
                  </div>
                </div>

                {/* Badge 3 */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#0e182f]/80 border border-[#1c2c4d]">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Safe & Private</h4>
                    <p className="text-[11px] text-slate-400">Your data is secure</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Glowing Hologram / AI Face & Target Box */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
                {/* Outer orbital rings */}
                <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-spin" style={{ animationDuration: '40s' }} />
                <div className="absolute inset-4 rounded-full border border-dashed border-cyan-400/30 animate-spin" style={{ animationDuration: '25s', animationDirection: 'reverse' }} />

                {/* Center glowing circle */}
                <div className="w-56 h-56 rounded-full bg-gradient-to-tr from-cyan-900/40 via-[#0e1e3b] to-indigo-950/60 p-1 border border-cyan-400/40 shadow-[0_0_35px_rgba(6,182,212,0.25)] relative flex items-center justify-center overflow-hidden">
                  {/* Cyber grid & nodes background */}
                  <svg className="absolute inset-0 w-full h-full opacity-35" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="3 3" />
                    <circle cx="50" cy="50" r="30" fill="none" stroke="#6366f1" strokeWidth="0.5" />
                    <line x1="50" y1="0" x2="50" y2="100" stroke="#22d3ee" strokeWidth="0.3" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#22d3ee" strokeWidth="0.3" />
                  </svg>

                  {/* Stylized AI Head Mesh Silhouette */}
                  <svg className="w-36 h-36 text-cyan-400/80 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M12 2C8 2 6 5 6 9c0 2.5 1 4.5 2 6 1 1.5 1.5 3 1.5 5h5c0-2 .5-3.5 1.5-5 1-1.5 2-3.5 2-6 0-4-2-7-6-7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 10c1 0 1.5-.5 1.5-1M15 10c-1 0-1.5-.5-1.5-1M12 12v2m-1 2h2" />
                  </svg>

                  {/* Target scanner lesion box overlay (Cheek area) */}
                  <div className="absolute bottom-10 right-10 w-20 h-20 rounded-xl border border-cyan-400 bg-cyan-950/70 p-1 shadow-[0_0_20px_rgba(6,182,212,0.6)] backdrop-blur-sm flex flex-col justify-between">
                    <div className="flex justify-between items-center text-[9px] text-cyan-300 font-mono">
                      <span>SCAN</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    </div>
                    {/* Lesion thumbnail */}
                    <div className="w-full h-11 rounded-lg overflow-hidden border border-cyan-400/40">
                      <img src="/samples/hist_nv.jpg" alt="scanner" className="w-full h-full object-cover" />
                    </div>
                    {/* Reticle corners */}
                    <div className="text-[8px] text-cyan-400 font-mono text-center leading-none">
                      AI: 98.4%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* START A NEW SCAN CARD */}
        <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-6 sm:p-7 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center gap-5">
            {/* Upload arrow icon container */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#12203f] to-[#1c305c] border border-cyan-500/25 flex items-center justify-center shrink-0 text-cyan-400 shadow-md">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Start a New Scan</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md">
                Upload a clear close-up image of the affected skin area to get AI analysis.
              </p>
              <div className="mt-4">
                <button
                  onClick={() => navigate('/scan')}
                  className="btn-gradient px-6 py-2.5 rounded-xl text-sm"
                >
                  Upload Image &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* Right illustration: Picture card thumbnails */}
          <div className="hidden sm:flex items-center gap-3 p-3 rounded-2xl bg-[#070c17] border border-[#15223c]">
            <div className="flex -space-x-4 overflow-hidden">
              <img className="inline-block h-12 w-12 rounded-xl ring-2 ring-[#0a1122] object-cover" src="/samples/hist_nv.jpg" alt="sample" />
              <img className="inline-block h-12 w-12 rounded-xl ring-2 ring-[#0a1122] object-cover" src="/samples/hist_bcc.jpg" alt="sample" />
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-300">JPG, PNG, WEBP</p>
              <p className="text-[10px] text-slate-500">(Max 10 MB)</p>
            </div>
          </div>
        </div>

        {/* RECENT SCAN HISTORY */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight">Recent Scan History</h2>
            <button
              onClick={() => navigate('/history')}
              className="text-xs sm:text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              View all &rarr;
            </button>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayScans.map((scan) => (
              <div
                key={scan.id}
                onClick={() => {
                  if (scan.isReal) {
                    navigate('/result', { state: { result: scan.raw } })
                  } else {
                    navigate('/scan')
                  }
                }}
                className="group relative rounded-2xl bg-[#0a1122] border border-[#16223d] hover:border-cyan-500/40 p-3.5 transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-950/20"
              >
                {/* Lesion image */}
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-black/40 border border-[#1b2b4b] relative mb-3">
                  <img
                    src={scan.image}
                    alt={scan.prediction}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {scan.isReal && token && (
                    <button
                      onClick={(e) => handleDeleteScan(e, scan.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-slate-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete scan"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Metadata */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${scan.dotColor} shrink-0`} />
                    <p className="text-xs font-bold text-white truncate">{scan.prediction}</p>
                  </div>
                  <p className="text-xs font-semibold text-cyan-400 pl-4">
                    {scan.confidence}% confidence
                  </p>
                  <p className="text-[11px] text-slate-500 pl-4">{scan.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* EDUCATIONAL DISCLAIMER BANNER */}
        <div className="rounded-2xl bg-[#091122] border border-[#162544] p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white tracking-wide">Educational Purpose Only</h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                DermiAI provides AI-based analysis for educational and informational purposes only. It is not a medical diagnosis. Always consult a qualified dermatologist for professional advice.
              </p>
            </div>
          </div>
          <div className="hidden sm:block text-slate-600 shrink-0">
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
