'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Building2, CreditCard, LayoutDashboard, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'

const links = [
  { href: '/platform/dashboard', label: 'النظرة العامة', icon: LayoutDashboard },
  { href: '/platform/tenants', label: 'الشركات المشتركة', icon: Building2 },
  { href: '/platform/plans', label: 'خطط الاشتراك', icon: CreditCard },
]

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [pathname])
  if (pathname === '/platform/login') return <>{children}</>

  const logout = () => {
    localStorage.removeItem('platform_access_token')
    window.location.href = '/platform/login'
  }

  return (
    <div className="platform-shell" dir="rtl">
      <header className="platform-mobile-bar">
        <button onClick={() => setOpen(true)} aria-label="فتح القائمة"><Menu size={21} /></button>
        <PlatformBrand compact />
        <ThemeToggle className="platform-mobile-theme" />
      </header>
      {open ? <button className="platform-scrim" onClick={() => setOpen(false)} aria-label="إغلاق القائمة" /> : null}

      <aside className={`platform-sidebar ${open ? 'is-open' : ''}`}>
        <div className="platform-sidebar-head">
          <PlatformBrand />
          <button className="platform-close" onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button>
        </div>

        <div className="platform-owner-badge"><ShieldCheck size={17} /><div><b>إدارة المنصة</b><small>صلاحيات المالك محمية ومستقلة</small></div></div>

        <nav aria-label="تنقل مالك المنصة">
          <p>إدارة وردية</p>
          {links.map(item => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return <Link key={item.href} href={item.href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}><Icon size={18} /><span>{item.label}</span>{active ? <i /> : null}</Link>
          })}
        </nav>

        <footer>
          <ThemeToggle className="platform-theme" />
          <button onClick={logout}><LogOut size={17} /><span>تسجيل الخروج</span></button>
        </footer>
      </aside>
      <main className="platform-content">{children}</main>
    </div>
  )
}

function PlatformBrand({ compact = false }: { compact?: boolean }) {
  return <div className={`platform-brand ${compact ? 'is-compact' : ''}`}><span className="wardiya-mark" role="img" aria-label="شعار نظام وردية" /><div><strong>نظام وردية</strong>{compact ? null : <small>إدارة أسهل، ورديات أذكى</small>}</div></div>
}
