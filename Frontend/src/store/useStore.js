import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const applyThemeToDom = (theme) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.add('light')
    root.classList.remove('dark')
    root.setAttribute('data-theme', 'light')
    root.style.colorScheme = 'light'
  } else {
    root.classList.add('dark')
    root.classList.remove('light')
    root.setAttribute('data-theme', 'dark')
    root.style.colorScheme = 'dark'
  }
  try {
    localStorage.setItem('theme', theme)
  } catch (_e) {}
}

const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'dark'
  try {
    const raw = localStorage.getItem('dermai-app')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.state?.theme) return parsed.state.theme
    }
    return localStorage.getItem('theme') || 'dark'
  } catch (_e) {
    return 'dark'
  }
}

const useStore = create(
  persist(
    (set) => ({
      theme: getStoredTheme(),
      token: null,
      user: null, // Will store { id, email, display_name, photo_url }
      selectedImage: null,
      activeScan: null,
      processingError: null,
      processingStep: 0,

      setTheme: (theme) => {
        applyThemeToDom(theme)
        set({ theme })
      },
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light'
          applyThemeToDom(next)
          return { theme: next }
        }),
      setSession: ({ token, user }) => set({ token, user }),
      clearSession: () => set({ token: null, user: null }),
      setSelectedImage: (selectedImage) => set({ selectedImage }),
      clearSelectedImage: () => set({ selectedImage: null }),
      setActiveScan: (activeScan) => set({ activeScan }),
      clearActiveScan: () => set({ activeScan: null }),
      setProcessingError: (processingError) => set({ processingError }),
      setProcessingStep: (processingStep) => set({ processingStep }),
      resetProcessingState: () => set({ processingError: null, processingStep: 0 }),
      logout: () =>
        set({
          token: null,
          user: null,
          activeScan: null,
          processingError: null,
          processingStep: 0,
          selectedImage: null,
        }),
    }),
    {
      name: 'dermai-app',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        activeScan: state.activeScan,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyThemeToDom(state.theme)
        }
      },
    },
  ),
)

export default useStore
