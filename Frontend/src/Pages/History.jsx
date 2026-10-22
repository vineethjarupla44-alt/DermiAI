import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import api, { assetUrl } from '../api'
import useStore from '../store/useStore'
import AppShell from '../components/AppShell'

export default function History() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const token = useStore((s) => s.token)

  useEffect(() => {
    let mounted = true

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    async function load() {
      setLoading(true)
      try {
        const res = await api.get('/history')
        if (mounted) setHistory(res.data)
      } catch {
        if (mounted) setHistory([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()

    return () => {
      mounted = false
    }
  }, [token, navigate])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!token) return
    try {
      await api.delete(`/history/${id}`)
      setHistory((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      console.error('Failed to delete history item:', err)
    }
  }

  return (
    <AppShell
      backTo="/dashboard"
      breadcrumbs={[
        { label: 'Overview', to: '/dashboard' },
        { label: 'Scan History' },
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Scan History</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review your previously processed skin lesion analyses and explainability heatmaps.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-[#0a1122] border border-[#172544] overflow-hidden shadow-xl"
        >
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-sm">
              Loading saved scan records…
            </div>
          ) : history.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0d1527] border border-[#1e2e4f] text-slate-500 flex items-center justify-center mx-auto text-xl">
                📂
              </div>
              <h3 className="text-base font-bold text-white">No history found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You haven't saved any scans yet. Run your first analysis to see it appear here.
              </p>
              <button
                onClick={() => navigate('/scan')}
                className="btn-gradient px-5 py-2.5 rounded-xl text-xs mt-2"
              >
                Start First Scan &rarr;
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#070c17] border-b border-[#172544] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Lesion / ID</th>
                    <th className="p-4">Prediction</th>
                    <th className="p-4">Confidence</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#172544]/60 text-xs">
                  {history.map((record, i) => (
                    <motion.tr
                      key={record.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate('/result', { state: { result: record } })}
                      className="hover:bg-cyan-500/[0.03] transition-colors cursor-pointer group"
                    >
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-black/60 border border-[#1b2b4b] shrink-0">
                            <img
                              src={record.original_url ? assetUrl(record.original_url) : '/samples/hist_nv.jpg'}
                              alt="lesion"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="font-mono text-[11px] text-cyan-300 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                            #{String(record.id).substring(0, 8)}
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-white text-sm block">
                          {record.prediction}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {record.risk_level || 'Low (educational)'}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2 max-w-[120px]">
                          <div className="h-1.5 w-full bg-[#131f38] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-cyan-400"
                              style={{ width: `${record.confidence}%` }}
                            />
                          </div>
                          <span className="font-bold text-white">
                            {Math.round(record.confidence)}%
                          </span>
                        </div>
                      </td>

                      <td className="p-4 text-slate-400">
                        {new Date(record.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={(e) => handleDelete(e, record.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete scan record"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  )
}
