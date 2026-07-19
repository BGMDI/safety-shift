'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api'
import { ThemeToggle } from '../../../components/layout/theme-toggle'

/* ══════════ الأنواع ══════════ */
interface RosterRow { id: string; fullName: string; employeeCode: string; log: { status: string } | null }
interface Shift { id: string; name: string; startTime: string; endTime: string; minStaffing: number | null }
interface SchedEntry { employeeId: string; shiftId: string; date: string }
interface LeaveReq { id: string; startDate: string; endDate: string; createdAt: string; employee: { fullName: string; employeeCode: string }; leaveType: { name: string } }
interface UniformReq { id: string; uniformType: string; size: string | null; quantity: number; createdAt: string; employee: { fullName: string; employeeCode: string } }
interface OnboardingReq { id: string; type: string; scheduledDate: string; createdAt: string; employee: { fullName: string; employeeCode: string } }
interface AuditEntry { id: string; action: string; module: string; createdAt: string; actor: { fullName: string } | null; subject: { fullName: string } | null }

type QueueItem = {
  key: string; kind: 'leave' | 'uniform' | 'onboarding'
  name: string; title: string; detail: string; createdAt: string; href: string
}

const MODULE_LABEL: Record<string, string> = {
  attendance: 'الحضور', employees: 'الموظفون', departments: 'الأقسام', branches: 'الفروع',
  payroll: 'الرواتب', leaves: 'الإجازات', roles: 'الصلاحيات', custody: 'العهد', uniforms: 'بدلة العمل',
}
const ACTION_LABEL: Record<string, string> = { CREATE: 'أنشأ', UPDATE: 'عدّل', DELETE: 'حذف' }
const ACTION_TONE: Record<string, 'good' | 'warn' | 'crit'> = { CREATE: 'good', UPDATE: 'warn', DELETE: 'crit' }

const fmtRelative = (iso: string) => {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'الآن'
  if (diffMin < 60) return `منذ ${diffMin} د`
  const h = Math.round(diffMin / 60)
  if (h < 24) return `منذ ${h} س`
  return new Date(iso).toLocaleDateString('ar-SA-u-ca-gregory')
}

export default function DashboardPage() {
  const [roster, setRoster] = useState<RosterRow[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [schedule, setSchedule] = useState<SchedEntry[]>([])
  const [leaves, setLeaves] = useState<LeaveReq[]>([])
  const [uniforms, setUniforms] = useState<UniformReq[]>([])
  const [onboarding, setOnboarding] = useState<OnboardingReq[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      api.get(`/attendance/roster?date=${today}`).then(r => setRoster(r.data)).catch(() => {}),
      api.get('/shifts').then(r => setShifts(r.data)).catch(() => {}),
      api.get(`/shifts/schedule?startDate=${today}&endDate=${today}`).then(r => setSchedule(r.data)).catch(() => {}),
      api.get('/leaves/requests?status=PENDING').then(r => setLeaves(r.data)).catch(() => {}),
      api.get('/uniforms?status=PENDING').then(r => setUniforms(r.data)).catch(() => {}),
      api.get('/onboarding').then(r => setOnboarding((r.data as any[]).filter(o => o.status === 'PENDING'))).catch(() => {}),
      api.get('/audit?limit=8').then(r => setAudit(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const kpi = useMemo(() => {
    const present = roster.filter(r => r.log?.status === 'PRESENT').length
    const late = roster.filter(r => r.log?.status === 'LATE').length
    const absent = roster.filter(r => r.log?.status === 'ABSENT').length
    return { total: roster.length, present, late, absent }
  }, [roster])

  const coverage = useMemo(() => {
    return shifts
      .filter(s => s.minStaffing != null && s.minStaffing > 0)
      .map(s => {
        const scheduled = schedule.filter(e => e.shiftId === s.id).length
        const pct = Math.min(100, Math.round((scheduled / (s.minStaffing as number)) * 100))
        const gap = (s.minStaffing as number) - scheduled
        return { ...s, scheduled, pct, gap: Math.max(0, gap) }
      })
  }, [shifts, schedule])

  const queue: QueueItem[] = useMemo(() => {
    const items: QueueItem[] = [
      ...leaves.map(l => ({
        key: `leave-${l.id}`, kind: 'leave' as const, name: l.employee.fullName,
        title: l.leaveType.name, detail: `${l.startDate.slice(0, 10)} ← ${l.endDate.slice(0, 10)}`,
        createdAt: l.createdAt, href: '/leaves',
      })),
      ...uniforms.map(u => ({
        key: `uniform-${u.id}`, kind: 'uniform' as const, name: u.employee.fullName,
        title: u.uniformType, detail: `${u.size ?? ''} · ×${u.quantity}`,
        createdAt: u.createdAt, href: '/uniforms',
      })),
      ...onboarding.map(o => ({
        key: `onboarding-${o.id}`, kind: 'onboarding' as const, name: o.employee.fullName,
        title: o.type === 'NEW_HIRE' ? 'مباشرة تعيين' : 'عودة من إجازة', detail: o.scheduledDate.slice(0, 10),
        createdAt: o.createdAt, href: '/onboarding',
      })),
    ]
    return items.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
  }, [leaves, uniforms, onboarding])

  const KIND_ICON = { leave: '🌴', uniform: '👔', onboarding: '🚪' }
  const KIND_LABEL = { leave: 'إجازة', uniform: 'بدلة عمل', onboarding: 'مباشرة' }

  if (loading) {
    return <div className="p-6 text-center py-20" style={{ color: 'var(--ink-3)' }}>جارٍ التحميل...</div>
  }

  return (
    <div style={{ background: 'var(--ground)', minHeight: '100%' }} className="p-6">
      <div className="max-w-6xl mx-auto">

        {/* شريط القيادة */}
        <div className="flex items-center gap-3 mb-6 reveal">
          <div>
            <p className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--brand)' }}>مركز القيادة</p>
            <h1 className="text-2xl font-extrabold" style={{ color: 'var(--ink)' }}>لوحة التحكم</h1>
          </div>
          <div className="flex-1" />
          <span className="text-xs px-3 py-1.5 rounded-full flex items-center gap-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--good)' }} />
            {new Date().toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <ThemeToggle />
        </div>

        {/* مؤشرات KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Kpi label="الحاضرون اليوم" value={kpi.present} sub={`من ${kpi.total}`} tone="good" delay=".04s" />
          <Kpi label="متأخرون" value={kpi.late} tone="warn" delay=".08s" />
          <Kpi label="غائبون" value={kpi.absent} tone="crit" delay=".12s" />
          <Kpi label="بانتظار الاعتماد" value={queue.length} tone="brand" delay=".16s" />
        </div>

        <div className="grid md:grid-cols-[1.5fr,1fr] gap-4 items-start">

          {/* العمود الأيسر */}
          <div className="space-y-4">
            {/* تغطية الورديات */}
            <Card icon="🕐" title="تغطية الورديات · اليوم" sub="محسوبة من الحد الأدنى المُهيّأ لكل وردية" delay=".2s">
              {coverage.length === 0 ? (
                <EmptyHint text="لم تُحدَّد أهداف تغطية بعد" action={{ label: 'حدّدها من صفحة الشفتات ←', href: '/shifts' }} />
              ) : (
                <div className="space-y-3">
                  {coverage.map(c => (
                    <div key={c.id} className="grid gap-3 items-center" style={{ gridTemplateColumns: '120px 1fr 60px' }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{c.name}</p>
                        <p className="text-xs font-mono" style={{ color: 'var(--ink-3)' }}>{c.startTime}–{c.endTime}</p>
                      </div>
                      <div className="h-[22px] rounded-lg overflow-hidden relative" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                        <div className="h-full rounded-lg transition-all" style={{
                          width: `${c.pct}%`,
                          background: c.pct >= 100 ? 'var(--good)' : c.pct >= 70 ? 'var(--warn)' : 'var(--crit)',
                        }} />
                      </div>
                      <div className="text-sm text-left">
                        <span className="font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{c.scheduled}</span>
                        <span style={{ color: 'var(--ink-3)' }}> /{c.minStaffing}</span>
                        {c.gap > 0 && (
                          <span className="text-xs font-bold rounded px-1.5 py-0.5 mr-1"
                            style={{ background: 'var(--crit-soft)', color: 'var(--crit)' }}>−{c.gap}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* النشاط الأخير */}
            <Card icon="📜" title="النشاط الأخير" sub="آخر العمليات في سجل التدقيق" delay=".3s">
              {audit.length === 0 ? (
                <EmptyHint text="لا يوجد نشاط مسجّل بعد" />
              ) : (
                <div>
                  {audit.map((a, i) => (
                    <div key={a.id} className="flex gap-3 py-2.5" style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                      <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{
                        background: `var(--${ACTION_TONE[a.action] ?? 'brand'})`,
                        boxShadow: `0 0 0 3px var(--${ACTION_TONE[a.action] ?? 'brand'}-soft)`,
                      }} />
                      <div className="min-w-0">
                        <p className="text-sm" style={{ color: 'var(--ink)' }}>
                          <b className="font-semibold">{a.actor?.fullName ?? 'النظام'}</b>
                          {' '}{ACTION_LABEL[a.action] ?? a.action} في {MODULE_LABEL[a.module] ?? a.module}
                          {a.subject ? <> — <span style={{ color: 'var(--ink-2)' }}>{a.subject.fullName}</span></> : ''}
                        </p>
                        <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--ink-3)' }}>{fmtRelative(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* العمود الأيمن */}
          <Card icon="✅" title="يتطلب إجراءً" sub={`${queue.length} طلب بانتظار الاعتماد`} delay=".24s">
            {queue.length === 0 ? (
              <EmptyHint text="لا توجد طلبات بانتظار الاعتماد 🎉" />
            ) : (
              <div>
                {queue.slice(0, 8).map((item, i) => (
                  <Link key={item.key} href={item.href}
                    className="flex items-start gap-3 py-2.5 -mx-1 px-1 rounded-lg transition"
                    style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                    <span className="text-lg flex-shrink-0">{KIND_ICON[item.kind]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{item.name}</p>
                      <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{KIND_LABEL[item.kind]} · {item.title} · {item.detail}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ══════════ مكوّنات مساعدة ══════════ */
function Kpi({ label, value, sub, tone, delay }: { label: string; value: number; sub?: string; tone: 'good' | 'warn' | 'crit' | 'brand'; delay: string }) {
  return (
    <div className="rounded-2xl p-4 reveal" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)', animationDelay: delay }}>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--ink-2)' }}>{label}</p>
      <p className="text-3xl font-extrabold tabular-nums" style={{ color: `var(--${tone})` }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>{sub}</p>}
    </div>
  )
}

function Card({ icon, title, sub, delay, children }: { icon: string; title: string; sub?: string; delay: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl overflow-hidden reveal" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)', animationDelay: delay }}>
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>{icon}</span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{title}</h2>
          {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{sub}</p>}
        </div>
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}

function EmptyHint({ text, action }: { text: string; action?: { label: string; href: string } }) {
  return (
    <div className="text-center py-8">
      <p className="text-sm" style={{ color: 'var(--ink-3)' }}>{text}</p>
      {action && <Link href={action.href} className="text-xs font-semibold mt-2 inline-block" style={{ color: 'var(--brand)' }}>{action.label}</Link>}
    </div>
  )
}
