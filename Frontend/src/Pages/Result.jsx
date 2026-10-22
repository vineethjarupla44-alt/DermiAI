import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '../components/AppShell'
import { assetUrl } from '../api'
import useStore from '../store/useStore'

// Condition clinical metadata
const CONDITION_DETAILS = {
  nv: {
    description: 'A melanocytic nevus is a common and usually benign skin lesion caused by a cluster of pigment-producing cells (melanocytes).',
    type: 'Benign (usually)',
    commonSites: 'Anywhere on body',
    typicalAppearance: 'Brown, round or oval mole',
    usualFeatures: 'Symmetrical, uniform color, regular borders',
    riskLevel: 'Low (educational)',
    riskColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    symptoms: [
      'Small, round or oval spot',
      'Brown or tan in color',
      'Usually smooth with regular borders',
      'May be flat or slightly raised',
    ],
  },
  bcc: {
    description: 'Basal Cell Carcinoma is the most common form of skin cancer. It typically grows slowly and rarely metastasizes, but requires prompt clinical evaluation.',
    type: 'Malignant (slow-growing)',
    commonSites: 'Face, ears, neck, shoulders',
    typicalAppearance: 'Pearly, translucent or waxy bump',
    usualFeatures: 'Rolled borders, visible tiny blood vessels',
    riskLevel: 'Moderate to High',
    riskColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    symptoms: [
      'Pearly or translucent pink bump',
      'Bleeding or oozing sore that crusts and returns',
      'Slightly raised border with central depression',
      'Firm scar-like white or yellow area',
    ],
  },
  akiec: {
    description: 'Actinic Keratosis is a rough, scaly lesion induced by cumulative ultraviolet radiation. It is considered precancerous and should be reviewed by a specialist.',
    type: 'Precancerous',
    commonSites: 'Face, scalp, forearms, hands',
    typicalAppearance: 'Rough, dry, scaly patch',
    usualFeatures: 'Sandpaper-like texture, pinkish-red hue',
    riskLevel: 'Moderate (precancerous)',
    riskColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    symptoms: [
      'Rough or scaly sandpaper-like texture',
      'Flat to slightly raised crusty patch',
      'Red, pink, or brownish surface',
      'Occasional itching, prickling, or tenderness',
    ],
  },
  bkl: {
    description: 'Benign Keratosis (seborrheic keratosis) is a non-cancerous skin growth common with aging. Despite their dark appearance, they are harmless.',
    type: 'Benign',
    commonSites: 'Chest, back, face, neck',
    typicalAppearance: 'Waxy, stuck-on appearance',
    usualFeatures: 'Well-demarcated, brown to black, wart-like',
    riskLevel: 'Low (educational)',
    riskColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    symptoms: [
      'Waxy, stuck-on look like candle wax',
      'Color ranges from light tan to dark brown/black',
      'Surface often rough or finely cracked',
      'Non-cancerous and does not spread',
    ],
  },
  df: {
    description: 'Dermatofibroma is a harmless, firm fibrous nodule in the skin, often developing after minor trauma such as an insect bite.',
    type: 'Benign',
    commonSites: 'Lower legs, arms, upper trunk',
    typicalAppearance: 'Firm, small reddish-brown button',
    usualFeatures: 'Dimples downward when pinched between fingers',
    riskLevel: 'Low (educational)',
    riskColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    symptoms: [
      'Firm, hard nodule under the skin surface',
      'Pink, reddish, or brownish color',
      'Typically 5–10 mm in diameter',
      'Characteristic dimple sign on lateral compression',
    ],
  },
  mel: {
    description: 'Melanoma is the most critical form of skin cancer, arising from pigment cells (melanocytes). Early detection and prompt surgical excision are essential.',
    type: 'Malignant (urgent)',
    commonSites: 'Sun-exposed skin, back, legs, arms',
    typicalAppearance: 'Asymmetric dark mole with irregular border',
    usualFeatures: 'Color variation (black, brown, blue, red), evolving size',
    riskLevel: 'High (urgent medical attention)',
    riskColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    symptoms: [
      'Asymmetrical shape and uneven borders',
      'Multiple shades of brown, black, or red',
      'Diameter frequently larger than 6 mm',
      'Evolving or rapidly changing mole',
    ],
  },
  vasc: {
    description: 'Vascular lesions include cherry angiomas, hemangiomas, or pyogenic granulomas involving superficial microvasculature.',
    type: 'Benign (usually)',
    commonSites: 'Trunk, extremities, head, and neck',
    typicalAppearance: 'Bright red to purple papule',
    usualFeatures: 'Blanches slightly under pressure; vascular origin',
    riskLevel: 'Low (monitor for bleeding)',
    riskColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    symptoms: [
      'Bright red, purple, or deep blue spots',
      'May be flat (macule) or dome-shaped (papule)',
      'Can bleed easily if irritated or scratched',
      'Smooth, discrete borders',
    ],
  },
}

export default function Result() {
  const navigate = useNavigate()
  const location = useLocation()
  const result = location.state?.result
  const originalFile = location.state?.originalFile

  const [activeModalImage, setActiveModalImage] = useState(null)
  const [copyToast, setCopyToast] = useState(false)

  useEffect(() => {
    if (!result) {
      navigate('/scan')
    } else {
      useStore.getState().setActiveScan(result)
    }
  }, [result, navigate])

  if (!result) return null

  // Resolve condition key
  const codeKey = (result.prediction_code || '').toLowerCase()
  const details = CONDITION_DETAILS[codeKey] || {
    description: result.prediction ? `${result.prediction} detected by the deep learning classifier.` : 'Skin lesion analysis result.',
    type: result.risk_level || 'Educational',
    commonSites: 'Skin surface',
    typicalAppearance: 'Skin lesion',
    usualFeatures: 'Analyzed via deep learning model',
    riskLevel: result.risk_level || 'Low (educational)',
    riskColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    symptoms: [
      'Visual asymmetry or surface variation',
      'Localized skin coloration change',
      'Surface texture irregularity',
      'Observe for progressive alterations over time',
    ],
  }

  // Resolve image URLs
  const isBase64 = (url) => url && url.startsWith('data:image')
  const originalImageUrl = originalFile
    ? URL.createObjectURL(originalFile)
    : result.original_url
    ? (isBase64(result.original_url) ? result.original_url : assetUrl(result.original_url))
    : '/samples/hist_nv.jpg'

  const gradcamUrl = result.heatmap_url
    ? (isBase64(result.heatmap_url) ? result.heatmap_url : assetUrl(result.heatmap_url))
    : originalImageUrl

  const saliencyUrl = result.saliency_url
    ? (isBase64(result.saliency_url) ? result.saliency_url : assetUrl(result.saliency_url))
    : gradcamUrl

  // Top 3 Predictions fallback if not returned
  const top3 = result.top3 && result.top3.length > 0
    ? result.top3
    : [
        { name: result.prediction || 'Melanocytic nevus', value: Math.round(result.confidence || 86) },
        { name: 'Benign keratosis', value: Math.max(1, Math.round((100 - (result.confidence || 86)) * 0.6)) },
        { name: 'Actinic keratosis', value: Math.max(1, Math.round((100 - (result.confidence || 86)) * 0.4)) },
      ]

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `DermiAI - ${result.prediction}`,
        text: `Skin lesion analysis: ${result.prediction} (${Math.round(result.confidence)}% confidence)`,
        url: window.location.href,
      }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(
        `DermiAI Analysis: ${result.prediction} (${Math.round(result.confidence)}% confidence)`
      )
      setCopyToast(true)
      setTimeout(() => setCopyToast(false), 2500)
    }
  }

  const handleDownloadReport = () => {
    window.print()
  }

  return (
    <AppShell
      backTo="/scan"
      breadcrumbs={[
        { label: 'New Scan', to: '/scan' },
        { label: 'Results' },
      ]}
      headerActions={
        <div className="flex items-center gap-2">
          {/* Share Button */}
          <button
            onClick={handleShare}
            className="btn-secondary px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5"
            title="Share analysis"
          >
            <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>

          {/* Download Report Button */}
          <button
            onClick={handleDownloadReport}
            className="btn-secondary px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5"
            title="Download PDF report"
          >
            <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Report
          </button>
        </div>
      }
    >
      <div className="space-y-6 max-w-6xl mx-auto print:p-0">
        {/* Toast confirmation */}
        <AnimatePresence>
          {copyToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-20 right-8 z-50 bg-teal-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-xl"
            >
              Link copied to clipboard!
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. ANALYSIS COMPLETE SUCCESS BANNER */}
        <div className="rounded-2xl bg-teal-950/25 border border-teal-500/30 p-4 sm:p-5 flex items-center gap-4 shadow-xl">
          <div className="w-9 h-9 rounded-full bg-teal-400 text-slate-950 font-extrabold flex items-center justify-center text-sm shrink-0 shadow-[0_0_15px_rgba(45,212,191,0.4)]">
            &#10003;
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight leading-tight">
              Analysis Complete
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Here is the AI analysis of your image with visual explanations.
            </p>
          </div>
        </div>

        {/* 2. THREE-COLUMN VISUAL EXPLANATION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Uploaded Image */}
          <div className="rounded-2xl bg-[#0a1122] border border-[#172544] p-3.5 flex flex-col justify-between shadow-xl">
            <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
              Uploaded Image
            </h3>
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/50 border border-[#1d2d4f] group">
              <img
                src={originalImageUrl}
                alt="Uploaded Lesion"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setActiveModalImage({ url: originalImageUrl, title: 'Uploaded Image' })}
                className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-colors"
                title="Zoom image"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Grad-CAM (Model Attention) */}
          <div className="rounded-2xl bg-[#0a1122] border border-[#172544] p-3.5 flex flex-col justify-between shadow-xl">
            <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
              Grad-CAM (Model Attention)
            </h3>
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/50 border border-[#1d2d4f] group">
              <img
                src={gradcamUrl}
                alt="Grad-CAM Attention Heatmap"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setActiveModalImage({ url: gradcamUrl, title: 'Grad-CAM (Model Attention)' })}
                className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-colors"
                title="Zoom Grad-CAM heatmap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Saliency Map */}
          <div className="rounded-2xl bg-[#0a1122] border border-[#172544] p-3.5 flex flex-col justify-between shadow-xl">
            <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
              Saliency Map
            </h3>
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/50 border border-[#1d2d4f] group">
              <img
                src={saliencyUrl}
                alt="Saliency Map"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setActiveModalImage({ url: saliencyUrl, title: 'Saliency Map' })}
                className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-colors"
                title="Zoom Saliency Map"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 3. TWO-COLUMN CLINICAL REPORT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Prediction, Top 3, Next Steps */}
          <div className="lg:col-span-7 space-y-5">
            {/* AI Prediction Card */}
            <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-6 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">
                    🤖
                  </span>
                  <span className="text-xs font-bold text-white tracking-wide uppercase">
                    Prediction
                  </span>
                </div>
                <span className="text-[11px] font-medium text-cyan-300 bg-cyan-950/60 border border-cyan-400/30 px-3 py-1 rounded-full">
                  Educational result, not a medical diagnosis
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-4 pt-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {result.prediction}
                </h1>
                <div className="text-right shrink-0">
                  <span className="text-xs text-slate-400 block">Confidence</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">
                    {Math.round(result.confidence)}%
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
                {details.description}
              </p>
            </div>

            {/* Top 3 Predictions Card */}
            <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Top 3 Predictions
                </h3>
              </div>

              <div className="space-y-3.5 pt-1">
                {top3.slice(0, 3).map((item, index) => (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold flex items-center justify-center text-[10px]">
                          {index + 1}
                        </span>
                        <span className={`font-semibold ${index === 0 ? 'text-white' : 'text-slate-300'}`}>
                          {item.name}
                        </span>
                      </div>
                      <span className="font-bold text-cyan-400">{item.value}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-[#131f38] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.value}%` }}
                        transition={{ duration: 0.8, delay: 0.2 + index * 0.15 }}
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Steps Card */}
            <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Next Steps
                </h3>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-start gap-3">
                  <span className="text-teal-400 text-sm font-bold mt-0.5">&#10003;</span>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Monitor the lesion for any changes in size, shape or color.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-teal-400 text-sm font-bold mt-0.5">&#10003;</span>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Consult a dermatologist if you notice any unusual changes.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-teal-400 text-sm font-bold mt-0.5">&#10003;</span>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    This tool is for educational use only and does not replace professional medical advice.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: About This Condition, Typical Signs & Symptoms, Doctor Callout */}
          <div className="lg:col-span-5 space-y-5">
            {/* About This Condition Card */}
            <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">
                  ⓘ
                </div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  About This Condition
                </h3>
              </div>

              <div className="space-y-3 pt-1 divide-y divide-[#172544]/60">
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 flex items-center gap-2">
                    <span>🏷️</span> Type
                  </span>
                  <span className="font-semibold text-white">{details.type}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-3">
                  <span className="text-slate-400 flex items-center gap-2">
                    <span>📍</span> Common Sites
                  </span>
                  <span className="font-semibold text-white">{details.commonSites}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-3">
                  <span className="text-slate-400 flex items-center gap-2">
                    <span>👁️</span> Typical Appearance
                  </span>
                  <span className="font-semibold text-white truncate max-w-[180px] text-right">
                    {details.typicalAppearance}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-3">
                  <span className="text-slate-400 flex items-center gap-2">
                    <span>✨</span> Usual Features
                  </span>
                  <span className="font-semibold text-white truncate max-w-[180px] text-right">
                    {details.usualFeatures}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-3">
                  <span className="text-slate-400 flex items-center gap-2">
                    <span>🛡️</span> Risk Level
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${details.riskColor}`}>
                    {details.riskLevel}
                  </span>
                </div>
              </div>
            </div>

            {/* Typical Signs & Symptoms Card */}
            <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Typical Signs & Symptoms
                </h3>
              </div>

              <div className="space-y-2.5 pt-1">
                {details.symptoms.map((symptom, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {symptom}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* When to see a dermatologist? Callout Card */}
            <div className="rounded-3xl bg-[#091122] border border-[#162544] p-5 shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-900/40 border border-cyan-400/30 flex items-center justify-center text-2xl shrink-0 shadow-lg">
                👨‍⚕️
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  When to see a dermatologist?
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  If the lesion changes, bleeds, itches, or looks unusual, consult a qualified dermatologist.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FULL-SIZE IMAGE ZOOM MODAL */}
      <AnimatePresence>
        {activeModalImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-2xl w-full bg-[#0a1122] border border-cyan-500/30 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{activeModalImage.title}</h3>
                <button
                  onClick={() => setActiveModalImage(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="aspect-square w-full rounded-2xl overflow-hidden bg-black/60 border border-[#1b2b4b]">
                <img
                  src={activeModalImage.url}
                  alt={activeModalImage.title}
                  className="w-full h-full object-contain"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
