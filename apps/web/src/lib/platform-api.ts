import axios from 'axios'

/** عميل API منفصل تماماً لمالك المنصة — يستخدم توكناً مختلفاً بالكامل عن توكن الموظفين */
export const platformApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + '/api/v1',
})

platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

platformApi.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginRequest = error.config?.url?.endsWith('/platform-auth/login')
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('platform_access_token')
      window.location.href = '/platform/login'
    }
    return Promise.reject(error)
  },
)
