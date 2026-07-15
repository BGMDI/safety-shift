'use client'

/** أدوار المستخدم مقروءة من الـ JWT (للواجهة فقط — الحماية الفعلية في الخادم) */

export interface TokenPayload {
  sub: string
  tenantId: string
  email: string
  roles: string[]
  exp?: number
}

const MGMT_ROLES = ['super_admin', 'hr_manager', 'supervisor']
const HR_ROLES = ['super_admin', 'hr_manager']

export function decodeToken(): TokenPayload | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem('access_token')
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    return null
  }
}

export function getRoles(): string[] {
  return decodeToken()?.roles ?? []
}

export function getUserId(): string | null {
  return decodeToken()?.sub ?? null
}

export function isManager(): boolean {
  return getRoles().some((r) => MGMT_ROLES.includes(r))
}

export function isHR(): boolean {
  return getRoles().some((r) => HR_ROLES.includes(r))
}

export function isSuperAdmin(): boolean {
  return getRoles().includes('super_admin')
}
