import React, { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '../components/AppShell'
import { assetUrl } from '../api'
import useStore from '../store/useStore'

// ── Clinical metadata for all 7 skin lesion categories ──────────────────────────
const CONDITION_INFO = {
  akiec: {
    title: 'Actinic Keratosis',
    what: 'Actinic Keratosis (AK) is a rough, scaly patch of skin that develops from years of sun exposure. It is considered precancerous — meaning it can evolve into squamous cell carcinoma if untreated.',
    causes: 'Prolonged UV radiation, fair skin, outdoor lifestyle, or immunosuppression are common contributing factors.',
    symptoms: 'Rough or scaly patch (often red, pink, or brown), flat-to-slightly-raised lesion, itching or burning sensation in the area.',
    nextSteps: [
      'See a dermatologist promptly for a proper clinical evaluation.',
      'Treatment options include cryotherapy, topical creams (5-FU, imiquimod), or photodynamic therapy.',
      'Use broad-spectrum SPF 30+ sunscreen daily and avoid peak UV hours.',
      'Self-monitor and report any rapid changes in size, colour, or texture.',
    ],
    riskNote: 'Left untreated, approximately 5–10% of actinic keratoses progress to squamous cell carcinoma.',
  },
  bcc: {
    title: 'Basal Cell Carcinoma',
    what: 'Basal Cell Carcinoma (BCC) is the most common type of skin cancer. It originates in the basal cells — the bottom layer of the epidermis. BCC rarely metastasises but can grow and become disfiguring if ignored.',
    causes: 'Cumulative UV exposure, history of sunburns, light skin and eyes, radiation therapy, and certain genetic syndromes.',
    symptoms: 'Pearly or waxy bump, flat flesh-coloured or brown scar-like lesion, bleeding or oozing sore that heals and returns.',
    nextSteps: [
      'Seek urgent evaluation by a board-certified dermatologist or oncologist.',
      'Common treatments include Mohs surgery, excision, curettage, or radiation therapy.',
      'Avoid further UV exposure and wear protective clothing.',
      'Regular full-body skin checks every 6–12 months are strongly recommended.',
    ],
    riskNote: 'BCC is highly treatable when caught early. Early surgical removal typically results in a cure rate of >95%.',
  },
  bkl: {
    title: 'Benign Keratosis',
    what: 'Benign Keratosis (seborrhoeic keratosis) is a non-cancerous skin growth that commonly appears with age. Despite their sometimes alarming appearance, they are completely harmless.',
    causes: 'Age-related skin changes and genetics are the primary drivers. They are not caused by sun exposure or infections.',
    symptoms: 'Waxy, "stuck-on" appearance, brown to black colour, rough or warty surface, variable size from a few mm to several cm.',
    nextSteps: [
      'No medical treatment is required for purely cosmetic cases.',
      'Consult a dermatologist if the lesion bleeds, itches excessively, or changes rapidly.',
      'Removal options (for comfort or cosmesis) include cryotherapy or curettage.',
      'Continue routine skin self-exams to detect any new or changing lesions.',
    ],
    riskNote: 'Benign keratoses pose no cancer risk. However, melanoma can occasionally mimic their appearance — professional confirmation is wise.',
  },
  df: {
    title: 'Dermatofibroma',
    what: 'Dermatofibroma is a common, benign fibrous nodule that typically appears on the legs or arms. It is composed of fibroblasts and inflammatory cells and is generally harmless.',
    causes: 'Often triggered by minor skin injuries such as insect bites, ingrown hairs, or small puncture wounds.',
    symptoms: 'Small, firm, dome-shaped bump (usually 5–10 mm), brownish or reddish colour, "dimple sign" when pinched, mildly itchy or tender.',
    nextSteps: [
      'No treatment is necessary unless the lesion is bothersome or cosmetically concerning.',
      'A dermatologist can confirm the diagnosis clinically or with a simple biopsy.',
      'Surgical excision is an option but may leave a scar; laser therapy is another choice.',
      'Monitor for any rapid growth, ulceration, or colour change.',
    ],
    riskNote: 'Dermatofibromas are benign and do not become cancerous. Excision is curative.',
  },
  mel: {
    title: 'Melanoma',
    what: 'Melanoma is the most dangerous form of skin cancer, arising from the pigment-producing cells (melanocytes). It can spread rapidly to lymph nodes and other organs if not detected and treated early.',
    causes: 'UV radiation (sun and tanning beds), fair skin, family history, large number of moles, or a history of previous melanomas.',
    symptoms: 'Asymmetric mole, irregular borders, multiple colours (brown, black, red, white, blue), diameter >6 mm, evolving in shape, size, or colour.',
    nextSteps: [
      '⚠️ Seek immediate evaluation by a dermatologist or melanoma specialist.',
      'A skin biopsy is the definitive way to confirm or rule out melanoma.',
      'If confirmed, staging scans (CT, PET) may be needed to assess spread.',
      'Treatment may include surgical excision, immunotherapy, targeted therapy, or radiation.',
      'Practice the ABCDE rule (Asymmetry, Border, Colour, Diameter, Evolution) for self-monitoring.',
    ],
    riskNote: 'Early-stage melanoma (Stage I) has a 5-year survival rate of ~98%. Delayed treatment dramatically worsens outcomes.',
  },
  nv: {
    title: 'Melanocytic Nevus',
    what: 'Melanocytic Nevus (common mole) is a benign skin lesion formed by clusters of melanocytes. Most adults have 10–40 moles. The vast majority are completely harmless.',
    causes: 'Genetics, sun exposure during childhood, and hormonal changes (puberty, pregnancy) influence mole development.',
    symptoms: 'Symmetrical, well-defined round or oval shape, uniform colour (tan, brown, or skin-coloured), flat or slightly raised, usually <6 mm.',
    nextSteps: [
      'No immediate action is required for stable, ordinary moles.',
      'Practise monthly self-skin exams using the ABCDE checklist.',
      'Schedule an annual skin check with a dermatologist, especially if you have many moles.',
      'Seek prompt review for any mole that grows rapidly, bleeds, or changes appearance.',
    ],
    riskNote: 'Common moles carry a very low risk of turning into melanoma. Atypical (dysplastic) moles carry slightly higher risk and should be monitored closely.',
  },
  vasc: {
    title: 'Vascular Lesion',
    what: 'Vascular Lesion refers to abnormalities involving blood or lymphatic vessels near the skin surface, including haemangiomas, pyogenic granulomas, and angiokeratomas.',
    causes: 'Congenital factors, trauma, hormonal influences, or ageing. Pyogenic granulomas can arise after skin injury.',
    symptoms: 'Bright-red, purple, or blue colour; may bleed easily if traumatised; can be flat or raised; variable size.',
    nextSteps: [
      'Consult a dermatologist for proper characterisation — some vascular lesions require biopsy.',
      'Pyogenic granulomas often need removal (shave excision, laser, or cauterisation) due to bleeding risk.',
      'Most congenital haemangiomas resolve spontaneously in children; adults should still seek assessment.',
      'Protect the area from trauma to minimise bleeding risk.',
    ],
    riskNote: 'Most vascular lesions are benign. Rare cases of angiosarcoma can mimic benign lesions — professional evaluation is important.',
  },
}

const RISK_PALETTE = {
  Malignant: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', icon: '⚠️' },
  Precancerous: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: '🔶' },
  'Usually benign': { bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-400', icon: '✅' },
  Benign: { bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-400', icon: '✅' },
  Healthy: { bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-400', icon: '✅' },
  Unknown: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', icon: 'ℹ️' },
}

function resolveConditionKey(scan) {
  if (!scan) return 'nv'
  const code = (scan.prediction_code || '').toLowerCase().trim()
  if (code && CONDITION_INFO[code]) return code
  const name = (scan.prediction || scan.prediction_name || '').toLowerCase()
  for (const [key, val] of Object.entries(CONDITION_INFO)) {
    if (name.includes(val.title.toLowerCase()) || val.title.toLowerCase().includes(name) || key === name) {
      return key
    }
  }
  return 'nv'
}

export default function Explain() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeScan = useStore((s) => s.activeScan)

  // Use scan from route state or fall back to persisted active scan
  const scan = location.state?.result || activeScan
  const originalFile = location.state?.originalFile

  const [activeTab, setActiveTab] = useState('gradcam')
  const [sliderPos, setSliderPos] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [imgLoading, setImgLoading] = useState(true)
  const [imgError, setImgError] = useState(false)
  const containerRef = useRef(null)

  // Reset loading / error state whenever tab or scan image changes
  useEffect(() => {
    setImgLoading(true)
    setImgError(false)
  }, [activeTab, scan?.heatmap_url, scan?.saliency_url])

  // If no real scan exists, render clean empty state
  if (!scan) {
    return (
      <AppShell
        backTo="/dashboard"
        breadcrumbs={[
          { label: 'Overview', to: '/dashboard' },
          { label: 'Skin Guide' },
        ]}
        headerActions={
          <button
            onClick={() => navigate('/scan')}
            className="btn-gradient px-4 py-1.5 rounded-xl text-xs flex items-center gap-1.5"
          >
            <span>+</span> New Scan
          </button>
        }
      >
        <div className="max-w-4xl mx-auto py-12 px-4">
          <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-10 sm:p-14 text-center shadow-2xl relative overflow-hidden">
            {/* Ambient lighting */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

            <div className="relative z-10 space-y-6 max-w-lg mx-auto">
              <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-4xl mx-auto shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                🔬
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  No Scan Selected
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  AI Visual Attention Maps (Grad-CAM & Saliency) require an active scan. Upload and analyze a skin image or select a previous analysis from your scan history to inspect its visual explainability.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => navigate('/scan')}
                  className="btn-gradient px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg"
                >
                  <span>+</span> Start New Scan
                </button>
                <button
                  onClick={() => navigate('/history')}
                  className="btn-secondary px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2"
                >
                  Browse Scan History &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  // Real scan URLs
  const isBase64 = (url) => typeof url === 'string' && url.startsWith('data:image')

  const heatmapUrl = scan.heatmap_url
    ? (isBase64(scan.heatmap_url) ? scan.heatmap_url : assetUrl(scan.heatmap_url))
    : ''

  const saliencyUrl = scan.saliency_url
    ? (isBase64(scan.saliency_url) ? scan.saliency_url : assetUrl(scan.saliency_url))
    : ''

  const originalUrl = originalFile
    ? URL.createObjectURL(originalFile)
    : scan.original_url
    ? (isBase64(scan.original_url) ? scan.original_url : assetUrl(scan.original_url))
    : heatmapUrl

  // Clinical info matching the actual predicted class
  const predCode = resolveConditionKey(scan)
  const info = CONDITION_INFO[predCode] || CONDITION_INFO['nv']
  const conditionTitle = scan.prediction || scan.prediction_name || info.title
  const riskLabel = scan.risk_level || scan.risk || (predCode === 'mel' || predCode === 'bcc' ? 'Malignant' : predCode === 'akiec' ? 'Precancerous' : 'Benign')
  const palette = RISK_PALETTE[riskLabel] || RISK_PALETTE['Unknown']

  const tabs = [
    {
      id: 'gradcam',
      label: 'Grad-CAM',
      desc: 'Visualizes regions that strongly influenced the model’s diagnostic prediction.',
    },
    {
      id: 'saliency',
      label: 'Saliency Map',
      desc: 'Gradient-based pixel sensitivity highlighting structural borders and pigment clusters.',
    },
    {
      id: 'compare',
      label: 'Compare Slider',
      desc: 'Interactive split-view comparing the original lesion against the AI attention overlay.',
    },
  ]

  // Smooth pointer drag handlers for Compare Slider
  const updateSliderFromClientX = (clientX) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width <= 0) return
    const offset = Math.max(0, Math.min(clientX - rect.left, rect.width))
    setSliderPos(Math.round((offset / rect.width) * 100))
  }

  const handlePointerDown = (e) => {
    setIsDragging(true)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch (_e) {}
    updateSliderFromClientX(e.clientX)
  }

  const handlePointerMove = (e) => {
    if (!isDragging && e.buttons !== 1) return
    updateSliderFromClientX(e.clientX)
  }

  const handlePointerUp = (e) => {
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (_e) {}
  }

  return (
    <AppShell
      backTo="/dashboard"
      breadcrumbs={[
        { label: 'Overview', to: '/dashboard' },
        { label: 'Skin Guide' },
      ]}
      headerActions={
        <button
          onClick={() => navigate('/scan')}
          className="btn-gradient px-4 py-1.5 rounded-xl text-xs flex items-center gap-1.5"
        >
          <span>+</span> New Scan
        </button>
      }
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Skin Guide & Visual Explainability
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Inspect AI Visual Attention Maps and interpret deep learning feature activation for this scan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#0a1122] border border-[#172544] shadow-md">
              <span className="text-xs font-bold text-white">
                {conditionTitle}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${palette.bg} ${palette.border} ${palette.text}`}>
                {palette.icon} {riskLabel}
              </span>
              {scan.confidence !== undefined && (
                <span className="text-[11px] font-mono font-semibold text-cyan-400">
                  {Math.round(scan.confidence)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Visual Attention Section */}
        <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#172544] pb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                AI Visual Attention Maps
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {tabs.find((t) => t.id === activeTab)?.desc}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-[#070c17] p-1 rounded-xl border border-[#172544] self-start sm:self-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-cyan-400 to-indigo-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Container */}
          <div className="relative aspect-[16/10] sm:aspect-[16/9] max-h-[460px] w-full rounded-2xl overflow-hidden bg-black/60 border border-[#1d2d4f] flex items-center justify-center">
            {/* Loading Indicator */}
            {imgLoading && !imgError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin mb-3" />
                <span className="text-xs text-slate-300 font-medium tracking-wide">
                  Loading AI Attention Map…
                </span>
              </div>
            )}

            {/* Error Message */}
            {imgError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-xl mb-3">
                  ⚠️
                </div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Failed to Load Visualization
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  The visualization image could not be loaded from the server.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setImgError(false)
                      setImgLoading(true)
                    }}
                    className="btn-secondary px-3.5 py-1.5 rounded-xl text-xs"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => navigate('/scan')}
                    className="btn-gradient px-3.5 py-1.5 rounded-xl text-xs"
                  >
                    Run New Scan
                  </button>
                </div>
              </div>
            )}

            {/* TAB 1: Grad-CAM */}
            {activeTab === 'gradcam' && heatmapUrl && (
              <img
                src={heatmapUrl}
                alt="Grad-CAM Attention Map"
                onLoad={() => setImgLoading(false)}
                onError={() => {
                  setImgLoading(false)
                  setImgError(true)
                }}
                className="w-full h-full object-contain"
              />
            )}

            {/* TAB 2: Saliency Map */}
            {activeTab === 'saliency' && (
              saliencyUrl ? (
                <img
                  src={saliencyUrl}
                  alt="Saliency Sensitivity Map"
                  onLoad={() => setImgLoading(false)}
                  onError={() => {
                    setImgLoading(false)
                    setImgError(true)
                  }}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-8 text-slate-400 text-xs">
                  Saliency map is not available for this scan record.
                </div>
              )
            )}

            {/* TAB 3: Compare Slider */}
            {activeTab === 'compare' && (
              <div
                ref={containerRef}
                className="relative w-full h-full select-none cursor-ew-resize flex items-center justify-center touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {/* Underneath: Grad-CAM */}
                <img
                  src={heatmapUrl}
                  alt="Grad-CAM Heatmap"
                  onLoad={() => setImgLoading(false)}
                  onError={() => {
                    setImgLoading(false)
                    setImgError(true)
                  }}
                  className="w-full h-full object-contain pointer-events-none"
                />

                {/* On Top: Original Image with polygon clip-path */}
                {originalUrl && (
                  <img
                    src={originalUrl}
                    alt="Original Lesion"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
                  />
                )}

                {/* Overlay Badges */}
                <div className="absolute top-3 left-3 pointer-events-none z-10">
                  <span className="text-[10px] font-bold text-slate-200 bg-black/60 border border-white/10 px-2.5 py-1 rounded-lg backdrop-blur-md">
                    Original Lesion
                  </span>
                </div>
                <div className="absolute top-3 right-3 pointer-events-none z-10">
                  <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-500/30 px-2.5 py-1 rounded-lg backdrop-blur-md">
                    Grad-CAM Heatmap
                  </span>
                </div>

                {/* Divider Line & Handle */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.85)] pointer-events-none z-20"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="w-8 h-8 rounded-full bg-cyan-400 text-slate-950 font-extrabold flex items-center justify-center text-xs -translate-x-1/2 absolute top-1/2 -translate-y-1/2 shadow-lg shadow-cyan-500/40 border-2 border-slate-950 select-none">
                    ↔
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Clinical Knowledge & Guidance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: What is this condition & Typical symptoms */}
          <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight">
                {info.title}
              </h3>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${palette.bg} ${palette.border} ${palette.text}`}>
                {palette.icon} {riskLabel}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {info.what}
            </p>
            {info.causes && (
              <div className="pt-2 border-t border-[#172544]/60">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
                  Common Causes
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {info.causes}
                </p>
              </div>
            )}
            <div className="pt-2 border-t border-[#172544]/60">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
                Typical Symptoms
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {info.symptoms}
              </p>
            </div>
          </div>

          {/* Card 2: Recommended Next Steps */}
          <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-teal-400">✓</span> Recommended Next Steps
            </h3>
            <div className="space-y-2.5 pt-1">
              {info.nextSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-[#172544]/60">
              <p className="text-[11px] text-slate-400 italic leading-relaxed">
                {info.riskNote}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <button
            onClick={() => navigate('/scan')}
            className="btn-gradient px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2"
          >
            <span>+</span> Analyze Another Lesion
          </button>
          <button
            onClick={() => navigate('/history')}
            className="btn-secondary px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2"
          >
            View All Past Scans &rarr;
          </button>
        </div>
      </div>
    </AppShell>
  )
}
