'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { platformApi } from '../../../lib/platform-api'

interface Tenant {
  id: string; name: string; logo: string | null; planStatus: string; plan: string
  enabledModules: string[]
  subscriptionStartsAt: string | null; subscriptionEndsAt: string | null
  daysRemaining: number | null; isExpired: boolean
  maxUsers: number | null; usersUsed: number; usersRemaining: number | null
  _count: { employees: number }
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  TRIAL: { label: 'تجريبي', color: 'warn' }, ACTIVE: { label: 'نشط', color: 'good' },
  EXPIRED: { label: 'منتهٍ', color: 'crit' }, CANCELLED: { label: 'مُلغى', color: 'crit' },
}

const EXPIRING_SOON_DAYS = 14

function Kpi({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>{label}</p>
      <p className="text-2xl font-extrabold mt-1 tabular-nums" style={{ color: color ?? 'var(--ink)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>{sub}</p>}
    </div>
  )
}

export default function PlatformDashboardPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('platform_access_token')
    if (!token) { router.replace('/platform/login'); return }
    platformApi.get('/platform/tenants').then(r => setTenants(r.data)).catch(() => setTenants([])).finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const active = tenants.filter(t => t.planStatus === 'ACTIVE').length
    const totalUsed = tenants.reduce((s, t) => s + t.usersUsed, 0)
    const withLimit = tenants.filter(t => t.maxUsers != null)
    const totalCapacity = withLimit.reduce((s, t) => s + (t.maxUsers ?? 0), 0)
    const overLimit = tenants.filter(t => t.maxUsers != null && t.usersUsed >= t.maxUsers).length
    const expiringSoon = tenants.filter(t => t.daysRemaining !== null && !t.isExpired && t.daysRemaining <= EXPIRING_SOON_DAYS).length
    const expired = tenants.filter(t => t.isExpired).length
    return { active, totalUsed, totalCapacity, withLimitCount: withLimit.length, overLimit, expiringSoon, expired }
  }, [tenants])

  const sorted = useMemo(() => {
    return [...tenants].sort((a, b) => {
      const pctA = a.maxUsers ? a.usersUsed / a.maxUsers : -1
      const pctB = b.maxUsers ? b.usersUsed / b.maxUsers : -1
      return pctB - pctA
    })
  }, [tenants])

  if (loading) return <div className="p-6 text-center" style={{ color: 'var(--ink-3)' }}>جارٍ التحميل...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/platform/tenants" className="text-xs" style={{ color: 'var(--brand)' }}>← الشركات المشتركة</a>
          <h1 className="text-2xl font-extrabold mt-1" style={{ color: 'var(--ink)' }}>📊 داشبورد الاشتراكات والمقاعد</h1>
        </div>
        <a href="/platform/plans" className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--brand)' }}>📋 خطط الاشتراك</a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="الشركات المشتركة" value={tenants.length} sub={`${stats.active} نشطة`} />
        <Kpi label="إجمالي المستخدمين" value={stats.totalUsed} sub={stats.withLimitCount > 0 ? `من أصل ${stats.totalCapacity} مقعد محدود` : 'لا توجد حدود مقاعد بعد'} />
        <Kpi label="شركات تجاوزت الحد" value={stats.overLimit} color={stats.overLimit > 0 ? 'var(--crit)' : undefined} sub="بحاجة لزيادة المقاعد" />
        <Kpi label="اشتراكات تنتهي قريباً" value={stats.expiringSoon} color={stats.expiringSoon > 0 ? 'var(--warn)' : undefined} sub={`خلال ${EXPIRING_SOON_DAYS} يوماً`} />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>استخدام المقاعد لكل شركة</h2>
        </div>
        {tenants.length === 0 ? (
          <div className="text-center py-14" style={{ color: 'var(--ink-3)' }}>لا توجد شركات بعد</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {sorted.map(t => {
              const st = STATUS_LABEL[t.planStatus] ?? { label: t.planStatus, color: 'ink-3' }
              const pct = t.maxUsers ? Math.min(100, Math.round((t.usersUsed / t.maxUsers) * 100)) : null
              return (
                <a key={t.id} href="/platform/tenants" className="flex items-center gap-4 px-5 py-4 transition"
                  style={{ borderColor: 'var(--line)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
                    {t.logo ? (
                      <img src={`${process.env.NEXT_PUBLIC_API_URL}${t.logo}`} alt={t.name} className="w-full h-full object-cover" />
                    ) : t.name.charAt(0)}
                  </div>
                  <div className="min-w-0" style={{ width: 160 }}>
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{t.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium inline-block mt-0.5" style={{ background: `var(--${st.color}-soft)`, color: `var(--${st.color})` }}>{st.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {pct !== null ? (
                      <>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--crit)' : pct >= 80 ? 'var(--warn)' : 'var(--good)' }} />
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>{t.usersUsed} / {t.maxUsers} مستخدَم · متبقٍ {t.usersRemaining}</p>
                      </>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{t.usersUsed} مستخدَم · بلا حد أقصى للمقاعد</p>
                    )}
                  </div>
                  <div className="text-xs tabular-nums flex-shrink-0" style={{ width: 90, textAlign: 'left', color: t.isExpired ? 'var(--crit)' : 'var(--ink-3)' }}>
                    {t.daysRemaining === null ? '—' : t.isExpired ? 'منتهٍ' : `${t.daysRemaining} يوم متبقٍ`}
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
