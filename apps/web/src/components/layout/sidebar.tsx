'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getRoles, getModules } from '../../lib/auth'
import { api } from '../../lib/api'
import { ThemeToggle } from './theme-toggle'

type Access = 'all' | 'mgmt' | 'hr' | 'super'

interface NavItem { href: string; label: string; icon: string; access: Access; module?: string }
interface NavGroup { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'الرئيسية',
    items: [
      { href: '/me',        label: 'صفحتي',      icon: '👤', access: 'all' },
      { href: '/dashboard', label: 'لوحة التحكم', icon: '🏠', access: 'mgmt' },
    ],
  },
  {
    label: 'الموارد البشرية',
    items: [
      { href: '/employees',   label: 'الموظفون',         icon: '👥', access: 'mgmt' },
      { href: '/departments', label: 'الهيكل التنظيمي', icon: '🏢', access: 'mgmt' },
      { href: '/leaves',      label: 'الإجازات',          icon: '🌴', access: 'mgmt', module: 'LEAVES' },
      { href: '/onboarding',  label: 'المباشرات',         icon: '🚪', access: 'mgmt', module: 'ONBOARDING' },
      { href: '/custody',     label: 'العهد وإخلاء الطرف', icon: '📦', access: 'mgmt', module: 'CUSTODY' },
      { href: '/uniforms',    label: 'بدلة العمل',         icon: '👔', access: 'mgmt', module: 'UNIFORMS' },
    ],
  },
  {
    label: 'الحضور والشفتات',
    items: [
      { href: '/attendance', label: 'الحضور والانصراف', icon: '🕐', access: 'mgmt', module: 'ATTENDANCE' },
      { href: '/shifts',     label: 'جدولة الشفتات',    icon: '🔄', access: 'mgmt', module: 'SHIFTS' },
    ],
  },
  {
    label: 'المالية',
    items: [
      { href: '/payroll', label: 'مسير الرواتب', icon: '💰', access: 'hr', module: 'PAYROLL' },
    ],
  },
  {
    label: 'الإعدادات',
    items: [
      { href: '/roles',     label: 'الصلاحيات',      icon: '🔑', access: 'super', module: 'ROLES' },
      { href: '/approvals', label: 'مسار الاعتماد', icon: '✅', access: 'hr', module: 'APPROVALS' },
      { href: '/audit',     label: 'سجل التدقيق',    icon: '📜', access: 'hr', module: 'AUDIT' },
      { href: '/settings',  label: 'الإعدادات',      icon: '⚙️', access: 'mgmt' },
    ],
  },
]

function canAccess(access: Access, roles: string[]): boolean {
  if (access === 'all') return true
  const isSuper = roles.includes('super_admin')
  const isHR = isSuper || roles.includes('hr_manager')
  const isMgmt = isHR || roles.includes('supervisor')
  if (access === 'super') return isSuper
  if (access === 'hr') return isHR
  if (access === 'mgmt') return isMgmt
  return false
}

interface TenantBranding { name: string; logo: string | null }

export function Sidebar() {
  const pathname = usePathname()
  const [roles, setRoles] = useState<string[]>([])
  const [modules, setModules] = useState<string[]>([])
  const [tenant, setTenant] = useState<TenantBranding | null>(null)

  useEffect(() => {
    setRoles(getRoles()); setModules(getModules())
    api.get('/tenants/me').then(r => setTenant(r.data)).catch(() => {})
  }, [])

  // صفّي المجموعات والعناصر حسب دور المستخدم وحسب الأقسام المفعّلة في باقة الاشتراك
  const groups = navGroups
    .map(g => ({
      ...g,
      items: g.items.filter(it => canAccess(it.access, roles) && (!it.module || modules.includes(it.module))),
    }))
    .filter(g => g.items.length > 0)

  const isEmployee = roles.length === 0 || !roles.some(r => ['super_admin', 'hr_manager', 'supervisor'].includes(r))

  return (
    <aside className="w-64 min-h-screen flex flex-col flex-shrink-0"
      style={{ background: 'linear-gradient(180deg, var(--brand-2), #0A1F1B 70%)', color: '#E7EEEB' }}>
      <div className="p-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,.1)' }}>
          {tenant?.logo ? (
            <img src={`${process.env.NEXT_PUBLIC_API_URL}${tenant.logo}`} alt={tenant.name} className="w-full h-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/>
            </svg>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold truncate">{tenant?.name ?? 'نظام الشِّفتات'}</h2>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(231,238,235,.55)' }}>
            {isEmployee ? 'الخدمة الذاتية للموظف' : 'إدارة الموارد البشرية'}
          </p>
        </div>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-xs font-semibold uppercase px-3 mb-1 tracking-wide" style={{ color: 'rgba(231,238,235,.4)' }}>{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href
                return (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm"
                    style={active
                      ? { background: 'var(--brand)', color: '#fff', fontWeight: 600 }
                      : { color: 'rgba(231,238,235,.75)' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.06)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <button
          onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); window.location.href = '/login' }}
          className="flex-1 text-right text-sm transition px-3 py-2 rounded-lg"
          style={{ color: 'rgba(231,238,235,.55)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#DE6577'; e.currentTarget.style.background = 'rgba(255,255,255,.06)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(231,238,235,.55)'; e.currentTarget.style.background = 'transparent' }}
        >
          🔒 تسجيل الخروج
        </button>
        <ThemeToggle
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition"
          style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(231,238,235,.85)' }}
        />
      </div>
    </aside>
  )
}
