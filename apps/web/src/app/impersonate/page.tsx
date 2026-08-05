'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isManager } from '../../lib/auth'

function ImpersonateInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const token = params.get('t')
    if (!token) { setError('رابط دخول غير صالح'); return }
    localStorage.setItem('access_token', token)
    // جلسة انتحال قصيرة بلا تمديد — أزل أي refresh_token سابق حتى لا تُمدَّد الجلسة عند انتهائها
    localStorage.removeItem('refresh_token')
    window.history.replaceState(null, '', '/impersonate') // إزالة التوكن من شريط العنوان وسجل التصفح
    router.replace(isManager() ? '/dashboard' : '/me')
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
      {error || 'جارٍ الدخول إلى لوحة الشركة...'}
    </div>
  )
}

export default function ImpersonatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">جارٍ التحميل...</div>}>
      <ImpersonateInner />
    </Suspense>
  )
}
