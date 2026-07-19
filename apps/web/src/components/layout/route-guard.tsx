'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { decodeToken } from '../../lib/auth'

/** الصلاحية المطلوبة لكل مسار (بادئة المسار) */
const ROUTE_ACCESS: { prefix: string; access: 'all' | 'mgmt' | 'hr' | 'super' }[] = [
  { prefix: '/me',          access: 'all' },
  { prefix: '/employees',   access: 'mgmt' },
  { prefix: '/departments', access: 'mgmt' },
  { prefix: '/branches',    access: 'mgmt' },
  { prefix: '/job-titles',  access: 'mgmt' },
  { prefix: '/leaves',      access: 'mgmt' },
  { prefix: '/onboarding',  access: 'mgmt' },
  { prefix: '/custody',     access: 'mgmt' },
  { prefix: '/uniforms',    access: 'mgmt' },
  { prefix: '/attendance',  access: 'mgmt' },
  { prefix: '/shifts',      access: 'mgmt' },
  { prefix: '/dashboard',   access: 'mgmt' },
  { prefix: '/payroll',     access: 'hr' },
  { prefix: '/approvals',   access: 'hr' },
  { prefix: '/audit',       access: 'hr' },
  { prefix: '/roles',       access: 'super' },
  { prefix: '/settings',    access: 'mgmt' },
]

function hasAccess(access: string, roles: string[]): boolean {
  if (access === 'all') return true
  const isSuper = roles.includes('super_admin')
  const isHR = isSuper || roles.includes('hr_manager')
  const isMgmt = isHR || roles.includes('supervisor')
  if (access === 'super') return isSuper
  if (access === 'hr') return isHR
  if (access === 'mgmt') return isMgmt
  return false
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const token = decodeToken()
    if (!token) { router.replace('/login'); return }

    // انتهاء صلاحية التوكن
    if (token.exp && token.exp * 1000 < Date.now()) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      router.replace('/login')
      return
    }

    const rule = ROUTE_ACCESS.find(r => pathname.startsWith(r.prefix))
    // مسار غير معروف → اسمح (سيتحقق الخادم)، معروف → طبّق القاعدة
    if (!rule || hasAccess(rule.access, token.roles ?? [])) {
      setAllowed(true)
    } else {
      // موظف يحاول الوصول لصفحة إدارية → أعده لصفحته
      router.replace('/me')
    }
  }, [pathname, router])

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        جارٍ التحقق من الصلاحيات...
      </div>
    )
  }
  return <>{children}</>
}
