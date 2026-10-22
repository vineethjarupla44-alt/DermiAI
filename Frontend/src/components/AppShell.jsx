import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import useStore from '../store/useStore'

export default function AppShell({
  breadcrumbs = null,
  title = null,
  eyebrow = null,
  description = null,
  actions = null,
  showSearch = false,
  searchValue = '',
  onSearchChange = null,
  headerActions = null,
  backTo = null,
  children,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const user = useStore((s) => s.user)

  const displayName = user?.display_name || 'Vineeth J'
  const userInitial = (displayName.trim()[0] || 'V').toUpperCase()

  // Compute breadcrumbs if not explicitly passed
  const activeBreadcrumbs = breadcrumbs || (
    title ? [{ label: title }] : null
  )

  const effectiveHeaderActions = headerActions || actions

  return (
    <div className="min-h-screen bg-[#070c14] text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-10"
            >
              <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#070c14] min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 px-4 sm:px-8 border-b border-[#141f36] flex items-center justify-between sticky top-0 z-30 bg-[#070c14]/90 backdrop-blur-md">
          {/* Left section: Hamburger / Search / Breadcrumbs */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Dashboard Search */}
            {showSearch ? (
              <div className="relative max-w-sm w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search something..."
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="w-full bg-[#0d1527] border border-[#1a2642] rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 transition-colors"
                />
              </div>
            ) : (
              /* Breadcrumbs Navigation */
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 truncate">
                {backTo ? (
                  <button
                    onClick={() => (typeof backTo === 'string' ? navigate(backTo) : backTo())}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Go back"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                ) : null}
                {activeBreadcrumbs ? (
                  <div className="flex items-center gap-2 truncate">
                    {activeBreadcrumbs.map((crumb, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <span className="text-slate-600">&gt;</span>}
                        {crumb.to ? (
                          <button
                            onClick={() => navigate(crumb.to)}
                            className="hover:text-cyan-300 transition-colors"
                          >
                            {crumb.label}
                          </button>
                        ) : (
                          <span className={idx === activeBreadcrumbs.length - 1 ? 'text-white font-medium' : ''}>
                            {crumb.label}
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Right section: Header actions, Notifications, User avatar */}
          <div className="flex items-center gap-3 shrink-0 ml-3">
            {effectiveHeaderActions}

            {/* Notification bell with indicator */}
            <button
              onClick={() => navigate('/history')}
              className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Notifications"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#070c14]" />
            </button>

            {/* Avatar Pill */}
            <button
              onClick={() => navigate('/profile')}
              className="w-8 h-8 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-violet-400/20 hover:ring-cyan-400/50 transition-all"
              title={displayName}
            >
              {userInitial}
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
