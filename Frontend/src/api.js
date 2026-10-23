import axios from 'axios'
import useStore from './store/useStore'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutes timeout for medical AI inference on CPU
})

api.interceptors.request.use((config) => {
  const token = useStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-fallback from localhost to 127.0.0.1 in case of IPv6/IPv4 hostname resolution issues
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    if (
      (!error.response || error.message === 'Network Error') &&
      config &&
      !config._retry &&
      config.baseURL &&
      config.baseURL.includes('localhost')
    ) {
      config._retry = true
      config.baseURL = config.baseURL.replace('localhost', '127.0.0.1')
      if (config.url && config.url.includes('localhost')) {
        config.url = config.url.replace('localhost', '127.0.0.1')
      }
      return axios(config)
    }
    return Promise.reject(error)
  }
)

export function assetUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//.test(path) || /^data:/.test(path) || /^blob:/.test(path)) return path
  if (path.startsWith('/samples/')) return path
  return `${API_BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.detail || fallback
}

export default api
