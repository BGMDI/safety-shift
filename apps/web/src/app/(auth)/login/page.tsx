'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '../../../lib/api'
import { isManager } from '../../../lib/auth'
import { ArrowLeft, LockKeyhole, Mail } from 'lucide-react'

const schema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', data)
      localStorage.setItem('access_token', res.data.accessToken)
      localStorage.setItem('refresh_token', res.data.refreshToken)
      // الإدارة → لوحة التحكم، الموظف → صفحته الشخصية
      router.push(isManager() ? '/dashboard' : '/me')
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'حدث خطأ، حاول مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="wardiya-login">
      <section className="login-story" aria-label="هوية نظام وردية">
        <div className="story-orbit orbit-one" /><div className="story-orbit orbit-two" />
        <div className="story-content">
          <span className="wardiya-mark story-logo" role="img" aria-label="شعار نظام وردية" />
          <p className="story-kicker">WARDIYA · OPERATIONS</p>
          <h1>إدارة أسهل،<br/><span>ورديات أذكى.</span></h1>
          <p className="story-copy">مساحة واحدة تنظم فريقك، حضورهم، وردياتهم وحقوقهم اليومية بثقة ووضوح.</p>
          <div className="story-status"><i /><span>منظومة الموارد البشرية متصلة</span></div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-mobile-brand"><span className="wardiya-mark" aria-hidden="true" /><strong>نظام وردية</strong></div>
          <div className="login-heading">
            <span>مرحباً بعودتك</span>
            <h2>الدخول إلى نظام وردية</h2>
            <p>أدخل بيانات حسابك للانتقال إلى مساحة عملك.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="login-label">البريد الإلكتروني</label>
            <div className="login-input"><Mail size={18}/><input {...register('email')} type="email" autoComplete="email" placeholder="name@company.com" /></div>
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="login-label">كلمة المرور</label>
            <div className="login-input"><LockKeyhole size={18}/><input {...register('password')} type="password" autoComplete="current-password" placeholder="••••••••" /></div>
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="login-submit">
            <span>{loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}</span>
            {loading ? null : <ArrowLeft size={18}/>}
          </button>
        </form>
          <p className="login-footnote">الدخول مخصص لموظفي المنشأة والمستخدمين المصرح لهم.</p>
        </div>
      </section>
    </main>
  )
}
