'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { platformApi } from '../../../lib/platform-api'

export default function PlatformLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError(''); setLoading(true)
    try {
      const r = await platformApi.post('/platform-auth/login', form)
      localStorage.setItem('platform_access_token', r.data.accessToken)
      router.push('/platform/tenants')
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'بيانات الدخول غير صحيحة')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-lift)' }}>
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--brand-soft)' }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>لوحة مالك المنصة</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>حساب منفصل تماماً عن حسابات الشركات المشتركة</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>البريد الإلكتروني</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>كلمة المرور</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--crit)' }}>{error}</p>}
          <button onClick={submit} disabled={loading || !form.email || !form.password}
            className="w-full text-sm font-semibold text-white rounded-lg py-2.5 mt-2 disabled:opacity-50"
            style={{ background: 'var(--brand)' }}>
            {loading ? '⏳ جارٍ الدخول...' : 'تسجيل الدخول'}
          </button>
        </div>
      </div>
    </div>
  )
}
