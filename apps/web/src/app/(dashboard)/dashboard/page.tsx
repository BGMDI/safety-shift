'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api'
import { ThemeToggle } from '../../../components/layout/theme-toggle'
import { getUserId } from '../../../lib/auth'

/* ══════════ الأنواع ══════════ */
interface RosterRow { id: string; fullName: string; employeeCode: string; log: { status: string } | null }
interface Shift { id: string; name: string; startTime: string; endTime: string; minStaffing: number | null }
interface SchedEntry { employeeId: string; shiftId: string; date: string }
interface LeaveReq { id: string; startDate: string; endDate: string; createdAt: string; employee: { fullName: string; employeeCode: string }; leaveType: { name: string } }
interface UniformReq { id: string; uniformType: string; size: string | null; quantity: number; createdAt: string; employee: { fullName: string; employeeCode: string } }
interface OnboardingReq { id: string; type: string; scheduledDate: string; createdAt: string; employee: { fullName: string; employeeCode: string } }
interface AuditEntry { id: string; action: string; module: string; createdAt: string; actor: { fullName: string } | null; subject: { fullName: string } | null }
interface DayCounts { date: string; present: number; late: number; absent: number; total: number }

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
const toArabicDigits = (n: number | string) => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d])
const dateStr = (d: Date) => d.toISOString().slice(0, 10)

export default function DashboardPage() {
  const [roster, setRoster] = useState<RosterRow[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [schedule, setSchedule] = useState<SchedEntry[]>([])
  const [leaves, setLeaves] = useState<LeaveReq[]>([])
  const [uniforms, setUniforms] = useState<UniformReq[]>([])
  const [onboarding, setOnboarding] = useState<OnboardingReq[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [history, setHistory] = useState<DayCounts[]>([])
  const [meName, setMeName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date()
    const todayStr = dateStr(today)
    const last7 = Array.from({ length: 7 }, (_, i) => dateStr(new Date(today.getTime() - (6 - i) * 86400000)))
    const uid = getUserId()

    Promise.all([
      api.get(`/attendance/roster?date=${todayStr}`).then(r => setRoster(r.data)).catch(() => {}),
      api.get('/shifts').then(r => setShifts(r.data)).catch(() => {}),
      api.get(`/shifts/schedule?startDate=${todayStr}&endDate=${todayStr}`).then(r => setSchedule(r.data)).catch(() => {}),
      api.get('/leaves/requests?status=PENDING').then(r => setLeaves(r.data)).catch(() => {}),
      api.get('/uniforms?status=PENDING').then(r => setUniforms(r.data)).catch(() => {}),
      api.get('/onboarding').then(r => setOnboarding((r.data as any[]).filter(o => o.status === 'PENDING'))).catch(() => {}),
      api.get('/audit?limit=8').then(r => setAudit(r.data)).catch(() => {}),
      uid ? api.get(`/employees/${uid}`).then(r => setMeName(r.data.fullName)).catch(() => {}) : Promise.resolve(),
      // اتجاه 7 أيام حقيقي — نفس نقطة نهاية كشف التحضير، لكن لأيام سابقة فعلية
      Promise.all(last7.map(d => api.get(`/attendance/roster?date=${d}`).then(r => ({
        date: d,
        present: r.data.filter((x: RosterRow) => x.log?.status === 'PRESENT').length,
        late: r.data.filter((x: RosterRow) => x.log?.status === 'LATE').length,
        absent: r.data.filter((x: RosterRow) => x.log?.status === 'ABSENT').length,
        total: r.data.length,
      } as DayCounts)).catch(() => ({ date: d, present: 0, late: 0, absent: 0, total: 0 } as DayCounts))))
        .then(setHistory),
    ]).finally(() => setLoading(false))
  }, [])

  const kpi = useMemo(() => {
    const present = roster.filter(r => r.log?.status === 'PRESENT').length
    const late = roster.filter(r => r.log?.status === 'LATE').length
    const absent = roster.filter(r => r.log?.status === 'ABSENT').length
    const excused = roster.filter(r => r.log?.status === 'EXCUSED').length
    const unrecorded = roster.filter(r => !r.log).length
    return { total: roster.length, present, late, absent, excused, unrecorded }
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

  const avgCoveragePct = useMemo(() => {
    if (coverage.length === 0) return null
    return Math.round(coverage.reduce((s, c) => s + c.pct, 0) / coverage.length)
  }, [coverage])

  /* اتجاهات حقيقية من تاريخ 7 أيام: خط مصغّر + نسبة مقارنة بمتوسط الأسبوع (باستثناء اليوم) */
  const trends = useMemo(() => {
    if (history.length < 2) return null
    const priorDays = history.slice(0, -1)
    const avg = (key: 'present' | 'late' | 'absent') => priorDays.reduce((s, d) => s + d[key], 0) / (priorDays.length || 1)
    const today = history[history.length - 1]
    const pct = (val: number, base: number) => (base === 0 ? null : Math.round(((val - base) / base) * 100))
    return {
      present: { series: history.map(d => d.present), vsAvg: pct(today.present, avg('present')) },
      late: { series: history.map(d => d.late), vsAvg: pct(today.late, avg('late')) },
      absent: { series: history.map(d => d.absent), vsAvg: pct(today.absent, avg('absent')) },
    }
  }, [history])

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

  const initial = meName.charAt(0) || '؟'

  return (
    <div style={{ background: 'var(--ground)', minHeight: '100%' }} className="p-6">
      <div className="max-w-6xl mx-auto">

        {/* شريط القيادة */}
        <div className="flex items-center gap-3 mb-6 reveal">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(150deg, var(--brand), var(--brand-2))', boxShadow: '0 6px 16px -6px color-mix(in srgb, var(--brand) 60%, transparent)' }}>
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-extrabold" style={{ color: 'var(--ink)' }}>نظام الشِّفتات</h1>
            <p className="text-xs" style={{ color: 'var(--ink-2)' }}>لوحة تحكم الموارد البشرية</p>
          </div>
          <div className="flex-1" />
          <span className="text-xs px-3 py-1.5 rounded-full flex items-center gap-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
            <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--good)' }} />
            اليوم <b style={{ color: 'var(--ink)' }}>{new Date().toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>
          </span>
          <ThemeToggle />
          {meName && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
              style={{ background: 'linear-gradient(150deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #7a4d10))' }}
              title={meName}>
              {initial}
            </div>
          )}
        </div>

        {/* مؤشرات KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Kpi label="الحاضرون اليوم" value={kpi.present} sub={`من ${kpi.total}`} tone="good" delay=".04s"
            series={trends?.present.series} vsAvg={trends?.present.vsAvg ?? null} />
          <Kpi label="متأخرون" value={kpi.late} tone="warn" delay=".08s"
            series={trends?.late.series} vsAvg={trends?.late.vsAvg ?? null} invertTrend />
          <Kpi label="غائبون" value={kpi.absent} tone="crit" delay=".12s"
            series={trends?.absent.series} vsAvg={trends?.absent.vsAvg ?? null} invertTrend />
          <Kpi label="تغطية الورديات" value={avgCoveragePct ?? 0} suffix="٪" sub={avgCoveragePct === null ? 'لم تُحدَّد أهداف بعد' : undefined} tone="brand" delay=".16s" />
        </div>

        <div className="grid md:grid-cols-[1.5fr,1fr] gap-4 items-start">

          {/* العمود الأيمن (RTL) — حالة اليوم */}
          <div className="space-y-4">
            {/* توزيع اليوم */}
            <Card icon="👥" title="توزيع اليوم" sub={`${toArabicDigits(kpi.total)} موظف نشط`} delay=".18s">
              <div className="h-[13px] rounded-full overflow-hidden flex gap-[2px] mb-3" style={{ background: 'var(--surface-2)' }}>
                {kpi.total > 0 && (
                  <>
                    <div style={{ width: `${(kpi.present / kpi.total) * 100}%`, background: 'var(--good)' }} />
                    <div style={{ width: `${(kpi.late / kpi.total) * 100}%`, background: 'var(--warn)' }} />
                    <div style={{ width: `${(kpi.excused / kpi.total) * 100}%`, background: 'var(--brand)' }} />
                    <div style={{ width: `${(kpi.absent / kpi.total) * 100}%`, background: 'var(--crit)' }} />
                    <div style={{ width: `${(kpi.unrecorded / kpi.total) * 100}%`, background: 'var(--line-strong)' }} />
                  </>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <Legend color="var(--good)" label="حاضر" value={kpi.present} />
                <Legend color="var(--warn)" label="متأخر" value={kpi.late} />
                <Legend color="var(--brand)" label="بعذر" value={kpi.excused} />
                <Legend color="var(--crit)" label="غائب" value={kpi.absent} />
                <Legend color="var(--line-strong)" label="لم يُحضَّر" value={kpi.unrecorded} />
              </div>
            </Card>

            {/* تغطية الورديات */}
            <Card icon="🕐" title="تغطية الورديات · اليوم" sub="محسوبة من الحد الأدنى المُهيّأ لكل وردية" delay=".22s">
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
          </div>

          {/* العمود الأيسر (RTL) — الإجراءات والسجل */}
          <div className="space-y-4">
            <Card icon="✅" title="يتطلب إجراءً" sub={`${queue.length} طلب بانتظار الاعتماد`} delay=".26s">
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

            {/* النشاط الأخير */}
            <Card icon="📜" title="النشاط الأخير" sub="آخر العمليات في سجل التدقيق" delay=".32s">
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
        </div>
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .live-dot { animation: dash-pulse 2.4s ease-out infinite; }
          @keyframes dash-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--good) 60%, transparent); } 70%,100% { box-shadow: 0 0 0 7px transparent; } }
        }
      `}</style>
    </div>
  )
}

/* ══════════ مكوّنات مساعدة ══════════ */
function Sparkline({ series, tone }: { series: number[]; tone: string }) {
  const max = Math.max(...series, 1)
  const min = Math.min(...series, 0)
  const range = max - min || 1
  const w = 120, h = 30
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  })
  const line = `M${pts.join(' L')}`
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-8 mt-2" aria-hidden="true">
      <path d={area} fill={`var(--${tone})`} opacity=".12" />
      <path d={line} fill="none" stroke={`var(--${tone})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CountUp({ to }: { to: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(to); return }
    let raf: number
    const start = performance.now(), dur = 700 + to * 3
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{toArabicDigits(val)}</>
}

function Kpi({ label, value, sub, suffix, tone, delay, series, vsAvg, invertTrend }: {
  label: string; value: number; sub?: string; suffix?: string; tone: 'good' | 'warn' | 'crit' | 'brand'; delay: string
  series?: number[]; vsAvg?: number | null; invertTrend?: boolean
}) {
  const trendGood = vsAvg != null && (invertTrend ? vsAvg <= 0 : vsAvg >= 0)
  return (
    <div className="rounded-2xl p-4 reveal relative overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)', animationDelay: delay }}>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--ink-2)' }}>{label}</p>
      <p className="text-3xl font-extrabold tabular-nums" style={{ color: `var(--${tone})` }}><CountUp to={value} />{suffix}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>{sub}</p>}
      {vsAvg != null && (
        <p className="text-xs mt-1 font-semibold" style={{ color: trendGood ? 'var(--good)' : 'var(--crit)' }}>
          {vsAvg >= 0 ? '▲' : '▼'} {toArabicDigits(Math.abs(vsAvg))}٪ عن متوسط الأسبوع
        </p>
      )}
      {series && series.length > 1 && <Sparkline series={series} tone={tone} />}
    </div>
  )
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs" style={{ color: 'var(--ink-2)' }}>{label}</span>
      <span className="text-xs font-bold mr-auto tabular-nums" style={{ color: 'var(--ink)' }}>{toArabicDigits(value)}</span>
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
