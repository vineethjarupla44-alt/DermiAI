import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api'
import useStore from '../store/useStore'

const STEPS = [
  { label: 'Validating image quality & lesion area…', icon: '🔍' },
  { label: 'Running deep learning classification…', icon: '🧠' },
  { label: 'Generating Grad-CAM & Saliency maps…', icon: '🔬' },
  { label: 'Finalizing clinical explanation…', icon: '📋' },
]

export default function Loading() {
  const navigate = useNavigate()
  const location = useLocation()
  const file = location.state?.file
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!file) {
      navigate('/scan', { replace: true })
      return
    }

    let active = true

    const run = async () => {
      // Smoothly advance through analysis steps
      const timer = setInterval(() => {
        setStep((p) => Math.min(p + 1, STEPS.length - 2))
      }, 700)

      try {
        const form = new FormData()
        form.append('file', file)

        // Do not manually force Content-Type; axios/browser automatically includes multipart boundary
        const { data: result } = await api.post('/diagnose', form, {
          timeout: 180000,
        })

        if (!active) {
          clearInterval(timer)
          return
        }

        clearInterval(timer)
        setStep(STEPS.length - 1)

        // Save active scan to store for Skin Guide and downstream views
        useStore.getState().setActiveScan(result)

        // Navigate directly to result screen
        navigate('/result', { replace: true, state: { result, originalFile: file } })
      } catch (err) {
        clearInterval(timer)
        if (active) {
          console.error('Diagnosis error:', err)
          let detail = err?.response?.data?.detail
          if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
            detail = 'Analysis timed out. The model is warming up on CPU. Please try again.'
          } else if (err?.message === 'Network Error') {
            detail = 'Cannot connect to backend server. Please verify backend is running on http://localhost:8000.'
          } else if (!detail) {
            detail = err?.message || 'Failed to process image. Please try again.'
          }
          setError(detail)
        }
      }
    }

    run()
    return () => {
      active = false
    }
  }, [file, navigate])

  const handleReturnToScan = () => {
    let thumbnail = ''
    try {
      if (file) thumbnail = URL.createObjectURL(file)
    } catch (_e) {}
    navigate('/scan', { state: { error, rejectedThumbnail: thumbnail } })
  }

  return (
    <div className="min-h-screen bg-[#070c14] flex flex-col items-center justify-center px-6 relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl bg-[#0a1122] border border-rose-500/40 p-8 sm:p-10 max-w-md w-full text-center relative z-10 shadow-2xl"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-2xl mx-auto mb-4">
              ✕
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {error.toLowerCase().includes('suitable') || error.toLowerCase().includes('lesion') || error.toLowerCase().includes('skin')
                ? 'Image Not Suitable'
                : 'Analysis Failed'}
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
              {error}
            </p>
            <button
              onClick={handleReturnToScan}
              className="btn-gradient w-full py-3.5 rounded-xl text-sm font-semibold"
            >
              &larr; Choose Another Image
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center max-w-sm w-full relative z-10 text-center"
          >
            {/* Pulsing ring spinner */}
            <div className="relative mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="w-24 h-24 rounded-full border-4 border-[#172544] border-t-cyan-400 border-r-indigo-500 shadow-[0_0_30px_rgba(34,211,238,0.3)]"
              />
              <div className="absolute inset-0 flex items-center justify-center text-3xl">
                {STEPS[step]?.icon || '🔬'}
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
              Analyzing Image…
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mb-8">
              Our AI is performing lesion detection & explainability mapping.
            </p>

            {/* Stepper progress cards */}
            <div className="w-full space-y-2.5 text-left">
              {STEPS.map((s, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs flex items-center gap-3 transition-all ${
                    idx === step
                      ? 'bg-cyan-500/10 border-cyan-400/40 text-cyan-300 font-semibold'
                      : idx < step
                      ? 'bg-[#0a1122] border-[#172544] text-teal-400'
                      : 'bg-[#0a1122]/50 border-transparent text-slate-500'
                  }`}
                >
                  <span className="w-5 text-center">
                    {idx < step ? '✓' : idx === step ? '●' : '○'}
                  </span>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
