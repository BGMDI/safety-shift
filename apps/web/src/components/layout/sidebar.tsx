'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getRoles } from '../../lib/auth'

type Access = 'all' | 'mgmt' | 'hr' | 'super'

interface NavItem { href: string; label: string; icon: string; access: Access }
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
      { href: '/leaves',      label: 'الإجازات',          icon: '🌴', access: 'mgmt' },
      { href: '/custody',     label: 'العهد وإخلاء الطرف', icon: '📦', access: 'mgmt' },
      { href: '/uniforms',    label: 'بدلة العمل',         icon: '👔', access: 'mgmt' },
    ],
  },
  {
    label: 'الحضور والشفتات',
    items: [
      { href: '/attendance', label: 'الحضور والانصراف', icon: '🕐', access: 'mgmt' },
      { href: '/shifts',     label: 'جدولة الشفتات',    icon: '🔄', access: 'mgmt' },
    ],
  },
  {
    label: 'المالية',
    items: [
      { href: '/payroll', label: 'مسير الرواتب', icon: '💰', access: 'hr' },
    ],
  },
  {
    label: 'الإعدادات',
    items: [
      { href: '/roles',    label: 'الصلاحيات',    icon: '🔑', access: 'super' },
      { href: '/audit',    label: 'سجل التدقيق',  icon: '📜', access: 'hr' },
      { href: '/settings', label: 'الإعدادات',    icon: '⚙️', access: 'mgmt' },
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

export function Sidebar() {
  const pathname = usePathname()
  const [roles, setRoles] = useState<string[]>([])

  useEffect(() => { setRoles(getRoles()) }, [])

  // صفّي المجموعات والعناصر حسب دور المستخدم
  const groups = navGroups
    .map(g => ({ ...g, items: g.items.filter(it => canAccess(it.access, roles)) }))
    .filter(g => g.items.length > 0)

  const isEmployee = roles.length === 0 || !roles.some(r => ['super_admin', 'hr_manager', 'supervisor'].includes(r))

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-5 border-b border-gray-700">
        <h2 className="text-lg font-bold">نظام الشفتات</h2>
        <p className="text-gray-400 text-xs mt-0.5">
          {isEmployee ? 'الخدمة الذاتية للموظف' : 'إدارة الموارد البشرية'}
        </p>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-gray-500 text-xs font-semibold uppercase px-3 mb-1">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                    pathname === item.href
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}>
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); window.location.href = '/login' }}
          className="w-full text-right text-gray-400 text-sm hover:text-red-400 transition px-3 py-2 rounded-lg hover:bg-gray-800"
        >
          🚪 تسجيل الخروج
        </button>
      </div>
    </aside>
  )
}
