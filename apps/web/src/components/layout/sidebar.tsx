'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Activity, BadgeCheck, Banknote, Building2, CalendarClock, ClipboardCheck, Clock3, FileClock, LayoutDashboard, LogOut, Menu, PackageCheck, Settings, ShieldCheck, Shirt, UserRound, UsersRound, X } from 'lucide-react'
import { getRoles, getModules } from '../../lib/auth'
import { ThemeToggle } from './theme-toggle'
import { api } from '../../lib/api'

interface TenantBrand { id: string; name: string; logo: string | null }

type Access = 'all' | 'mgmt' | 'hr' | 'super'
interface NavItem { href: string; label: string; icon: LucideIcon; access: Access; module?: string }

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: 'مساحة العمل', items: [
    { href: '/me', label: 'صفحتي', icon: UserRound, access: 'all' },
    { href: '/dashboard', label: 'لوحة العمليات', icon: LayoutDashboard, access: 'mgmt' },
  ]},
  { label: 'إدارة الفريق', items: [
    { href: '/employees', label: 'الموظفون', icon: UsersRound, access: 'mgmt' },
    { href: '/departments', label: 'الهيكل التنظيمي', icon: Building2, access: 'mgmt' },
    { href: '/leaves', label: 'الإجازات', icon: CalendarClock, access: 'mgmt', module: 'LEAVES' },
    { href: '/onboarding', label: 'المباشرات', icon: BadgeCheck, access: 'mgmt', module: 'ONBOARDING' },
    { href: '/custody', label: 'العهد وإخلاء الطرف', icon: PackageCheck, access: 'mgmt', module: 'CUSTODY' },
    { href: '/uniforms', label: 'بدلة العمل', icon: Shirt, access: 'mgmt', module: 'UNIFORMS' },
  ]},
  { label: 'التشغيل اليومي', items: [
    { href: '/attendance', label: 'الحضور والانصراف', icon: Clock3, access: 'mgmt', module: 'ATTENDANCE' },
    { href: '/shifts', label: 'جدولة الشفتات', icon: Activity, access: 'mgmt', module: 'SHIFTS' },
    { href: '/payroll', label: 'مسير الرواتب', icon: Banknote, access: 'hr', module: 'PAYROLL' },
  ]},
  { label: 'التحكم', items: [
    { href: '/roles', label: 'الصلاحيات', icon: ShieldCheck, access: 'super', module: 'ROLES' },
    { href: '/approvals', label: 'مسار الاعتماد', icon: ClipboardCheck, access: 'hr', module: 'APPROVALS' },
    { href: '/audit', label: 'سجل التدقيق', icon: FileClock, access: 'hr', module: 'AUDIT' },
    { href: '/settings', label: 'الإعدادات', icon: Settings, access: 'mgmt' },
  ]},
]

function canAccess(access: Access, roles: string[]) {
  if (access === 'all') return true
  const superAdmin = roles.includes('super_admin')
  const hr = superAdmin || roles.includes('hr_manager')
  const management = hr || roles.includes('supervisor')
  return access === 'super' ? superAdmin : access === 'hr' ? hr : management
}

export function Sidebar() {
  const pathname = usePathname()
  const [roles, setRoles] = useState<string[]>([])
  const [modules, setModules] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [tenant, setTenant] = useState<TenantBrand | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const refreshBrand = () => {
      if (!localStorage.getItem('access_token')) return
      api.get<TenantBrand>('/tenants/me', { signal: controller.signal })
        .then(({ data }) => setTenant(data))
        .catch(() => { /* Keep the existing brand during temporary connection failures. */ })
    }
    refreshBrand()
    window.addEventListener('focus', refreshBrand)
    return () => {
      controller.abort()
      window.removeEventListener('focus', refreshBrand)
    }
  }, [])

  useEffect(() => {
    setRoles(getRoles())
    setModules(getModules())
  }, [])
  useEffect(() => setOpen(false), [pathname])

  const groups = navGroups.map(group => ({ ...group, items: group.items.filter(item => canAccess(item.access, roles) && (!item.module || modules.includes(item.module))) })).filter(group => group.items.length)
  const isEmployee = roles.length === 0 || !roles.some(role => ['super_admin', 'hr_manager', 'supervisor'].includes(role))

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    window.location.href = '/login'
  }

  return (
    <>
      <header className="mobile-bar">
        <button onClick={() => setOpen(true)} className="mobile-menu" aria-label="فتح القائمة"><Menu size={21} /></button>
        <Brand compact tenant={tenant} />
        <ThemeToggle className="mobile-theme" />
      </header>
      {open ? <button className="sidebar-scrim" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} /> : null}

      <aside className={`ops-sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-head">
          <Brand tenant={tenant} />
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button>
        </div>

        <div className="sidebar-status">
          <span className="status-pulse" />
          <div><b>النظام متصل</b><small>{isEmployee ? 'بوابة الخدمة الذاتية' : 'مركز عمليات الموارد البشرية'}</small></div>
        </div>

        <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
          {groups.map(group => (
            <section key={group.label} className="nav-group">
              <h2>{group.label}</h2>
              <div>{group.items.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))
                const NavIcon = item.icon
                return (
                  <Link key={item.href} href={item.href} className={`nav-link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                    <NavIcon size={18} strokeWidth={active ? 2.3 : 1.8} /><span>{item.label}</span>{active ? <i /> : null}
                  </Link>
                )
              })}</div>
            </section>
          ))}
        </nav>

        <footer className="sidebar-footer">
          <ThemeToggle className="sidebar-theme" />
          <button onClick={logout} className="logout-button"><LogOut size={17} /><span>تسجيل الخروج</span></button>
        </footer>
      </aside>
    </>
  )
}

function Brand({ compact = false, tenant }: { compact?: boolean; tenant: TenantBrand | null }) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null)
  const logo = tenant?.logo
  const logoUrl = logo ? (/^https?:\/\//i.test(logo) ? logo : `${(process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')}/${logo.replace(/^\/+/, '')}`) : null
  return (
    <div className={`brand-lockup ${compact ? 'is-compact' : ''}`}>
      {logoUrl && failedLogo !== logoUrl ? (
        <img className="brand-logo tenant-logo" src={logoUrl} alt={`شعار ${tenant?.name ?? 'الشركة'}`} onError={() => setFailedLogo(logoUrl)} />
      ) : (
        <span className="brand-logo wardiya-mark" role="img" aria-label="شعار نظام وردية" />
      )}
      <div><strong>{tenant?.name || 'نظام وردية'}</strong>{compact ? null : <small>{tenant?.name ? 'نظام وردية · إدارة أسهل، ورديات أذكى' : 'إدارة أسهل، ورديات أذكى'}</small>}</div>
    </div>
  )
}
