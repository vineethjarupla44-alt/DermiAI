import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { auth } from '../../firebase'
import { signOut } from 'firebase/auth'
import useStore from '../store/useStore'

export default function Sidebar({ onCloseMobile }) {
  const navigate = useNavigate()
  const user = useStore((s) => s.user)
  const token = useStore((s) => s.token)
  const logout = useStore((s) => s.logout)

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      try {
        await signOut(auth)
      } catch (_e) {
        // Fallback
      }
      logout()
      navigate('/')
    }
  }

  const navItems = [
    {
      to: '/dashboard',
      label: 'Overview',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      to: '/scan',
      label: 'New Scan',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3H5a2 2 0 00-2 2v4m16-6h-4a2 2 0 012 2v4M3 15v4a2 2 0 002 2h4m12-6v4a2 2 0 01-2 2h-4M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
        </svg>
      ),
    },
    {
      to: '/history',
      label: 'Scan History',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      to: '/explain',
      label: 'Skin Guide',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      to: '/profile',
      label: 'Profile',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ]

  // Name and initial calculation
  const displayName = user?.display_name || 'Vineeth J'
  const userInitial = (displayName.trim()[0] || 'V').toUpperCase()
  const userRole = user?.email ? (user.email.length > 18 ? user.email.slice(0, 16) + '...' : user.email) : 'Student'

  return (
    <aside className="w-64 shrink-0 bg-[#090e1c] border-r border-[#15223c] flex flex-col justify-between min-h-screen p-5 select-none z-40">
      {/* Top Branding */}
      <div>
        <div 
          onClick={() => { navigate('/dashboard'); onCloseMobile?.() }}
          className="flex items-center gap-3 cursor-pointer px-1 py-1 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 p-[1.5px] shadow-[0_0_15px_rgba(6,182,212,0.35)] flex items-center justify-center">
            <div className="w-full h-full bg-[#090e1c] rounded-[10px] flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C7.5 7.5 4 11.5 4 15.5 4 19.64 7.58 23 12 23s8-3.36 8-7.5c0-4-3.5-8-8-13.5zm0 18.5c-3.04 0-5.5-2.46-5.5-5.5 0-2.88 2.68-6.19 5.5-9.87 2.82 3.68 5.5 6.99 5.5 9.87 0 3.04-2.46 5.5-5.5 5.5z"/>
              </svg>
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none group-hover:text-cyan-300 transition-colors">
              DermiAI
            </h1>
            <p className="text-[11px] text-slate-400 tracking-wide mt-1">
              AI for Skin Health
            </p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="mt-8 flex flex-col gap-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => onCloseMobile?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-cyan-500/12 text-cyan-300 font-semibold border border-cyan-400/25 shadow-[0_0_12px_rgba(34,211,238,0.12)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom section: Theme, User pill, Sign out */}
      <div className="pt-6 border-t border-[#15223c]/80 flex flex-col gap-3">
        {/* Theme pill */}
        <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400 rounded-lg bg-[#0d1527]/50 border border-[#17233d]">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            Theme
          </span>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 cursor-pointer hover:opacity-80" title="Light mode">☀️</span>
            <span className="text-cyan-400 cursor-pointer font-bold" title="Dark mode">🌙</span>
          </div>
        </div>

        {/* User Card */}
        <div 
          onClick={() => { navigate('/profile'); onCloseMobile?.() }}
          className="flex items-center gap-3 p-2 rounded-xl bg-[#0d1527] border border-[#17233d] cursor-pointer hover:border-cyan-500/30 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate leading-tight">
              {displayName}
            </p>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              {userRole}
            </p>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}
