import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '../components/AppShell'
import useStore from '../store/useStore'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function Scan() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSelectedImage = useStore((state) => state.setSelectedImage)
  const clearSelectedImage = useStore((state) => state.clearSelectedImage)
  const resetProcessingState = useStore((state) => state.resetProcessingState)

  const [activeTab, setActiveTab] = useState('upload') // 'upload' | 'camera'
  const [previewUrl, setPreviewUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState(location.state?.error || '')
  const [rejectedImageThumbnail, setRejectedImageThumbnail] = useState(location.state?.rejectedThumbnail || '')
  const [isDragging, setIsDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)

  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [previewUrl])

  function compressImageForUpload(file, maxDimension = 1200) {
    return new Promise((resolve) => {
      if (!file || file.size < 400 * 1024) {
        resolve(file)
        return
      }
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const cleanName = (file.name || 'scan').replace(/\.[^/.]+$/, '') + '.jpg'
              resolve(new File([blob], cleanName, { type: 'image/jpeg' }))
            } else {
              resolve(file)
            }
          },
          'image/jpeg',
          0.92
        )
      }
      img.onerror = () => resolve(file)
      img.src = URL.createObjectURL(file)
    })
  }

  async function selectFile(file) {
    if (!file || !ACCEPTED_TYPES.includes(file.type)) {
      setError('Please choose a valid JPEG, PNG, or WEBP image.')
      return
    }

    if (file.size < 500) {
      setError('The selected file appears to be empty or corrupted.')
      return
    }

    resetProcessingState()
    clearSelectedImage()
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }

    let processedFile = file
    try {
      if (file.size > 400 * 1024) {
        processedFile = await compressImageForUpload(file)
      }
    } catch (_e) {
      processedFile = file
    }

    const localUrl = URL.createObjectURL(processedFile)
    setPreviewUrl(localUrl)
    setSelectedFile(processedFile)
    setSelectedImage({ file: processedFile, previewUrl: localUrl, capturedAt: new Date().toISOString() })
    setError('')
  }

  async function openCamera() {
    try {
      setActiveTab('camera')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      setCameraOpen(true)
      setError('')
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (_error) {
      setError('Camera access was denied or unavailable on this device.')
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
    setActiveTab('upload')
  }

  function capturePhoto() {
    if (!videoRef.current || !cameraOpen) return

    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720

      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not get canvas context')

      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError('Could not capture image.')
            return
          }
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
          selectFile(file)
          closeCamera()
        },
        'image/jpeg',
        0.95
      )
    } catch (err) {
      console.error('Capture failed:', err)
      setError('Failed to capture photo.')
    }
  }

  const handleClearPreview = () => {
    clearSelectedImage()
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl('')
    setSelectedFile(null)
  }

  const handleStartAnalysis = () => {
    if (!selectedFile) return
    navigate('/loading', { state: { file: selectedFile } })
  }

  // 6 Image guidelines data
  const guidelines = [
    { label: 'Clear close-up', image: '/samples/guideline_clear.jpg', valid: true },
    { label: 'Good lighting', image: '/samples/guideline_lighting.jpg', valid: true },
    { label: 'Focus on lesion', image: '/samples/guideline_focus.jpg', valid: true },
    { label: 'Too far', image: '/samples/guideline_toofar.jpg', valid: false },
    { label: 'Blurry', image: '/samples/guideline_blurry.jpg', valid: false },
    { label: 'Not a skin image', image: '/samples/guideline_not_skin.jpg', valid: false },
  ]

  // Image validation checklist items
  const validationChecks = [
    'File type supported (JPG/PNG/WEBP)',
    'Image resolution is sufficient (min 224×224)',
    'Image is clear and not blurry',
    'Skin/lesion region detected',
    'Suitable for skin analysis',
  ]

  return (
    <AppShell
      backTo="/dashboard"
      breadcrumbs={[
        { label: 'New Scan', to: '/scan' },
        { label: 'Upload Image' },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 4-STEP PROGRESS INDICATOR */}
        <div className="flex items-center justify-center pt-2 pb-4">
          <div className="flex items-center w-full max-w-xl justify-between relative">
            {/* Step 1: Upload */}
            <div className="flex flex-col items-center z-10">
              <div className="w-8 h-8 rounded-full bg-cyan-400 text-[#070c14] font-bold text-xs flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.5)]">
                1
              </div>
              <span className="text-xs font-semibold text-cyan-400 mt-1.5">Upload</span>
            </div>

            {/* Connecting line 1-2 */}
            <div className="flex-1 h-[2px] bg-[#1e2e4f] -mt-5 mx-2" />

            {/* Step 2: Validate */}
            <div className="flex flex-col items-center z-10">
              <div className="w-8 h-8 rounded-full bg-[#0a1122] border border-[#22355b] text-slate-400 text-xs flex items-center justify-center">
                2
              </div>
              <span className="text-xs text-slate-400 mt-1.5">Validate</span>
            </div>

            {/* Connecting line 2-3 */}
            <div className="flex-1 h-[2px] bg-[#1e2e4f] -mt-5 mx-2" />

            {/* Step 3: Analyze */}
            <div className="flex flex-col items-center z-10">
              <div className="w-8 h-8 rounded-full bg-[#0a1122] border border-[#22355b] text-slate-400 text-xs flex items-center justify-center">
                3
              </div>
              <span className="text-xs text-slate-400 mt-1.5">Analyze</span>
            </div>

            {/* Connecting line 3-4 */}
            <div className="flex-1 h-[2px] bg-[#1e2e4f] -mt-5 mx-2" />

            {/* Step 4: Results */}
            <div className="flex flex-col items-center z-10">
              <div className="w-8 h-8 rounded-full bg-[#0a1122] border border-[#22355b] text-slate-400 text-xs flex items-center justify-center">
                4
              </div>
              <span className="text-xs text-slate-400 mt-1.5">Results</span>
            </div>
          </div>
        </div>

        {/* TAB SELECTOR: Upload Image vs Use Camera */}
        <div className="flex border-b border-[#182645] gap-4">
          <button
            onClick={() => {
              if (cameraOpen) closeCamera()
              setActiveTab('upload')
            }}
            className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 transition-all relative ${
              activeTab === 'upload'
                ? 'text-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload Image
            {activeTab === 'upload' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            )}
          </button>

          <button
            onClick={() => {
              openCamera()
            }}
            className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 transition-all relative ${
              activeTab === 'camera'
                ? 'text-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Use Camera
            {activeTab === 'camera' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            )}
          </button>
        </div>

        {/* HIDDEN FILE INPUT */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />

        {/* MAIN UPLOAD OR CAMERA CONTAINER */}
        {activeTab === 'camera' ? (
          /* CAMERA VIEW */
          <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-6 text-center space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full max-h-[440px] rounded-2xl object-cover bg-black border border-[#1d2d4f] mx-auto"
            />
            <div className="flex justify-center gap-4">
              <button
                onClick={capturePhoto}
                className="btn-gradient px-8 py-3 rounded-xl flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                Capture Photo
              </button>
              <button
                onClick={closeCamera}
                className="btn-secondary px-6 py-3 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !previewUrl ? (
          /* DRAG & DROP UPLOAD ZONE (Empty state) */
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragging(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              selectFile(e.dataTransfer.files?.[0])
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_25px_rgba(34,211,238,0.2)]'
                : 'border-[#1b2b4b] bg-[#091122]/70 hover:border-cyan-400/50 hover:bg-[#0c152a]'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              {/* Cloud upload icon matching screenshot */}
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight pt-2">
                Drag & drop your image here
              </h3>
              <p className="text-xs sm:text-sm text-cyan-400 font-medium cursor-pointer hover:underline">
                or click to browse files
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  className="btn-cyan px-7 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-cyan-500/20"
                >
                  Choose Image
                </button>
              </div>

              <p className="text-[11px] text-slate-500 pt-3">
                Supported formats: JPG, PNG, WEBP &nbsp;|&nbsp; Max size: 10 MB
              </p>
            </div>
          </div>
        ) : (
          /* PREVIEW & VALIDATION SECTION (Image selected state) */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 rounded-3xl bg-[#0a1122] border border-[#172544] p-6 shadow-xl">
            {/* Left Column: Image Validations Checklist */}
            <div className="md:col-span-7 flex flex-col justify-between space-y-5">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight mb-4">
                  Image Validations
                </h3>
                <div className="space-y-3">
                  {validationChecks.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs shrink-0 font-bold border border-teal-500/40">
                        &#10003;
                      </div>
                      <span className="text-xs sm:text-sm text-slate-300 font-medium">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Validate / Analyze Button */}
              <div className="pt-2">
                <button
                  onClick={handleStartAnalysis}
                  className="btn-gradient w-full py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                >
                  Validate Image &rarr;
                </button>
              </div>
            </div>

            {/* Right Column: Preview Card */}
            <div className="md:col-span-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Preview</span>
              </div>
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-[#1e3054] bg-black/50">
                <img
                  src={previewUrl}
                  alt="Selected skin lesion"
                  className="w-full h-full object-cover"
                />
                {/* Close X button */}
                <button
                  onClick={handleClearPreview}
                  className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center text-xs transition-colors border border-white/20"
                  title="Remove image"
                >
                  &#10005;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IMAGE GUIDELINES */}
        <div className="rounded-3xl bg-[#0a1122] border border-[#172544] p-5 sm:p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white tracking-tight mb-4">
            Image Guidelines
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {guidelines.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-[#1a2846] bg-black/40 mb-2">
                  <img
                    src={item.image}
                    alt={item.label}
                    className="w-full h-full object-cover"
                  />
                  {/* Badge */}
                  <span
                    className={`absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md ${
                      item.valid ? 'bg-teal-500' : 'bg-rose-500'
                    }`}
                  >
                    {item.valid ? '✓' : '✕'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 text-center leading-tight">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* REJECTION ALERT BOX (Shown when error or rejected image is flagged) */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-2xl bg-rose-950/30 border border-rose-500/40 p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xl"
            >
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 shadow-md shadow-rose-500/30">
                  ✕
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-400 tracking-tight">
                    Image not suitable for skin analysis
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {error.includes('suitable') || error.includes('lesion') || error.includes('skin')
                      ? error
                      : 'This image does not appear to be a clear close-up of a skin lesion. Please upload a close-up image of the affected skin area.'}
                  </p>
                </div>
              </div>

              {/* Mini thumbnail of rejected image */}
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-rose-500/50 shrink-0 bg-black/50">
                <img
                  src={rejectedImageThumbnail || '/samples/rejected_landscape.jpg'}
                  alt="rejected"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  ✕
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}
