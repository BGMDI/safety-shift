'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { platformApi } from '../../../lib/platform-api'

export default function PlatformLoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    setError(''); setLoading(true)
    try {
      const response = await platformApi.post('/platform-auth/login', { email, password })
      localStorage.setItem('platform_access_token', response.data.accessToken)
      router.push('/platform/dashboard')
    } catch (e: any) {
      setError(e.response?.data?.message ?? (e.request ? 'تعذر الاتصال بالخادم، حاول مرة أخرى' : 'تعذر تسجيل الدخول'))
    } finally { setLoading(false) }
  }

  return (
    <main className="platform-login" dir="rtl">
      <section className="platform-login-brand">
        <div className="platform-brand-content">
          <span className="wardiya-mark platform-hero-mark" role="img" aria-label="شعار نظام وردية" />
          <p className="platform-kicker">WARDIYA · PLATFORM</p>
          <h1>مركز قيادة<br/><span>نظام وردية</span></h1>
          <p>إدارة الشركات والباقات والاشتراكات من مساحة تشغيل واحدة وآمنة.</p>
          <div className="platform-security-note"><ShieldCheck size={18}/><div><b>نطاق إداري مستقل</b><small>لا تُستخدم فيه حسابات موظفي الشركات</small></div></div>
        </div>
      </section>

      <section className="platform-login-panel">
        <div className="platform-login-card">
          <div className="platform-login-mobile-brand"><span className="wardiya-mark"/><strong>نظام وردية</strong></div>
          <span className="platform-login-eyebrow"><ShieldCheck size={14}/> دخول مالك المنصة</span>
          <h2>مرحباً بعودتك</h2>
          <p className="platform-login-intro">أدخل بيانات الحساب الإداري للانتقال إلى مركز القيادة.</p>

          <form onSubmit={submit}>
            <label>البريد الإلكتروني</label>
            <div className="platform-login-input"><Mail size={18}/><input type="email" name="email" autoComplete="username" required placeholder="owner@wardiya.com" /></div>
            <label>كلمة المرور</label>
            <div className="platform-login-input"><LockKeyhole size={18}/><input type="password" name="password" autoComplete="current-password" required placeholder="••••••••" /></div>
            {error ? <p className="platform-login-error">{error}</p> : null}
            <button type="submit" disabled={loading}><span>{loading ? 'جارٍ التحقق...' : 'الدخول إلى مركز القيادة'}</span>{loading ? null : <ArrowLeft size={18}/>}</button>
          </form>
          <p className="platform-login-footnote">هذه المساحة مخصصة لمالك نظام وردية والمستخدمين المخولين فقط.</p>
        </div>
      </section>
    </main>
  )
}
