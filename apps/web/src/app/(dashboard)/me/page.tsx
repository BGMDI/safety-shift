'use client'
import { Fragment, useState, useEffect } from 'react'
import { api } from '../../../lib/api'
import { decodeToken } from '../../../lib/auth'

/* ══════════ الأنواع ══════════ */
interface Me {
  id: string; fullName: string; employeeCode: string
  email: string | null; phone: string | null; photo: string | null
  jobTitle: { name: string } | null
  department: { name: string } | null
  branch: { name: string } | null
  hireDate: string
}
interface AttLog {
  id?: string; date?: string; checkIn: string | null; checkOut: string | null
  lateMinutes: number; overtimeMinutes?: number; status: string
}
interface Balance {
  id: string; entitledDays: number; usedDays: number
  leaveType: { id: string; name: string }
}
interface LeaveType { id: string; name: string }
interface LeaveReq {
  id: string; startDate: string; endDate: string; status: string
  leaveType: { name: string }
}
interface SchedEntry { date: string; shiftName: string; startTime: string; endTime: string }
interface Payslip {
  id: string; baseSalary: string; totalAllowances: string; totalDeductions: string
  absenceDeduction: string; lateDeduction: string; netSalary: string
  payrollRun: { month: number; year: number; status: string }
}
interface CustodyItem { id: string; itemName: string; assignedDate: string; returnedDate: string | null; status: string }
interface UniformReq { id: string; uniformType: string; size: string | null; quantity: number; status: string; createdAt: string }
interface QueueItem {
  caseId: string; requestType: 'LEAVE' | 'UNIFORM' | 'ONBOARDING'; requestId: string
  stepLabel: string; stepOrder: number; totalSteps: number
  employee: { id: string; fullName: string; employeeCode: string }
  title: string; detail: string; createdAt: string
}
interface OnboardingReq { id: string; type: 'NEW_HIRE' | 'RETURN_FROM_LEAVE'; scheduledDate: string; notes: string | null; status: string; createdAt: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

const STATUS_ATT: Record<string, { label: string; color: string }> = {
  PRESENT: { label: 'حاضر', color: 'bg-green-100 text-green-700' },
  LATE:    { label: 'متأخر', color: 'bg-yellow-100 text-yellow-700' },
  ABSENT:  { label: 'غائب', color: 'bg-red-100 text-red-700' },
  EXCUSED: { label: 'بعذر', color: 'bg-blue-100 text-blue-700' },
  HOLIDAY: { label: 'إجازة', color: 'bg-purple-100 text-purple-700' },
  WEEKEND: { label: 'عطلة', color: 'bg-gray-100 text-gray-600' },
}
const STATUS_REQ: Record<string, { label: string; color: string }> = {
  PENDING:  { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: 'مقبولة', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'مرفوضة', color: 'bg-red-100 text-red-700' },
  ordered:  { label: '', color: '' },
}
const STATUS_UNI: Record<string, { label: string; color: string }> = {
  PENDING:  { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: 'مقبول', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'مرفوض', color: 'bg-red-100 text-red-700' },
}

const fmtTime = (dt: string | null) => dt ? new Date(dt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDate = (dt: string) => new Date(dt).toLocaleDateString('ar-SA-u-ca-gregory')
const fmtMin = (m: number) => { if (m <= 0) return '—'; const h = Math.floor(m / 60), mm = m % 60; return h > 0 ? `${h}س ${mm}د` : `${mm}د` }
const money = (v: string | number) => Number(v).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const now = new Date()
const localToday = () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

/* ══════════ الصفحة ══════════ */
export default function MyPage() {
  const [me, setMe]           = useState<Me | null>(null)
  const [today, setToday]     = useState<AttLog | null>(null)
  const [busy, setBusy]       = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'overview' | 'queue' | 'attendance' | 'schedule' | 'salary' | 'leaves' | 'custody' | 'onboarding'>('overview')

  const userId = typeof window !== 'undefined' ? decodeToken()?.sub : null
  const loadToday = () => api.get('/attendance/me/today').then(r => setToday(r.data)).catch(() => {})

  useEffect(() => {
    if (!userId) return
    Promise.all([
      api.get(`/employees/${userId}`).then(r => setMe(r.data)).catch(() => {}),
      loadToday(),
    ]).finally(() => setLoading(false))
  }, [userId])

  const check = async (type: 'in' | 'out') => {
    setBusy(true)
    try { await api.post('/attendance/self-check', { type }); loadToday() }
    catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="p-6 text-gray-400">جارٍ التحميل...</div>
  const initial = me?.fullName?.charAt(0) || '؟'

  const tabs = [
    { id: 'overview',   label: '👤 نظرة عامة' },
    { id: 'queue',      label: '✅ موافقاتي' },
    { id: 'attendance', label: '🕐 حضوري' },
    { id: 'schedule',   label: '📅 جدولي' },
    { id: 'salary',     label: '💰 راتبي' },
    { id: 'leaves',     label: '🌴 إجازاتي' },
    { id: 'custody',    label: '📦 عهدتي وبدلتي' },
    { id: 'onboarding', label: '🚪 مباشرتي' },
  ]

  return (
    <div className="p-6 max-w-4xl space-y-5">

      {/* بطاقة الملف */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-blue-50 flex items-center justify-center flex-shrink-0">
          {me?.photo
            ? <img src={`${API_URL}${me.photo}`} alt="" className="w-full h-full object-cover" />
            : <span className="text-blue-500 text-3xl font-bold">{initial}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{me?.fullName}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {me?.jobTitle?.name ?? 'بدون وظيفة'}
            {me?.department ? ` · ${me.department.name}` : ''}
            {me?.branch ? ` · ${me.branch.name}` : ''}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
            <span>🆔 {me?.employeeCode}</span>
            {me?.phone && <span>📱 {me.phone}</span>}
            {me?.email && <span>✉️ {me.email}</span>}
            {me?.hireDate && <span>📆 التعيين: {fmtDate(me.hireDate)}</span>}
          </div>
        </div>
      </div>

      {/* بطاقة تحضير اليوم */}
      <div className="bg-gradient-to-l from-blue-600 to-blue-500 rounded-2xl shadow-sm p-5 flex items-center gap-4 text-white">
        <div className="text-3xl">🕐</div>
        <div className="flex-1">
          <p className="font-semibold">تحضيري اليوم</p>
          <p className="text-blue-100 text-sm mt-0.5">
            {today?.checkIn
              ? <>حضور: {fmtTime(today.checkIn)}{today.checkOut ? ` · انصراف: ${fmtTime(today.checkOut)}` : ''}{today.lateMinutes > 0 ? ` · تأخير ${today.lateMinutes} د` : ''}</>
              : 'لم تسجل حضورك بعد'}
          </p>
        </div>
        {!today?.checkIn && (
          <button onClick={() => check('in')} disabled={busy}
            className="bg-white text-blue-700 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition">
            {busy ? '...' : '✓ تسجيل حضور'}
          </button>
        )}
        {today?.checkIn && !today?.checkOut && (
          <button onClick={() => check('out')} disabled={busy}
            className="bg-white/15 border border-white/40 text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-white/25 disabled:opacity-50 transition">
            {busy ? '...' : '🚪 تسجيل انصراف'}
          </button>
        )}
        {today?.checkIn && today?.checkOut && (
          <span className="bg-white/15 text-sm px-4 py-2 rounded-lg">✓ اكتمل يومك</span>
        )}
      </div>

      {/* التبويبات */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              tab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview'   && <OverviewTab userId={userId!} />}
      {tab === 'queue'      && <QueueTab />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'schedule'   && <ScheduleTab />}
      {tab === 'salary'     && <SalaryTab />}
      {tab === 'leaves'     && <LeavesTab userId={userId!} />}
      {tab === 'custody'    && <CustodyTab />}
      {tab === 'onboarding' && <OnboardingTab />}
    </div>
  )
}

/* ══════════ نظرة عامة: ملخص سريع ══════════ */
function OverviewTab({ userId }: { userId: string }) {
  const [balances, setBalances] = useState<Balance[]>([])
  const [att, setAtt] = useState<{ present: number; late: number; absent: number } | null>(null)

  useEffect(() => {
    api.get(`/leaves/balances/${userId}`).then(r => setBalances(r.data)).catch(() => {})
    api.get(`/attendance/me/logs?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .then(r => setAtt(r.data.summary)).catch(() => {})
  }, [userId])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-3">حضوري هذا الشهر</h2>
        {att ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-50 rounded-xl py-3"><p className="text-2xl font-bold text-green-600">{att.present}</p><p className="text-xs text-gray-500">حاضر</p></div>
            <div className="bg-yellow-50 rounded-xl py-3"><p className="text-2xl font-bold text-yellow-600">{att.late}</p><p className="text-xs text-gray-500">متأخر</p></div>
            <div className="bg-red-50 rounded-xl py-3"><p className="text-2xl font-bold text-red-600">{att.absent}</p><p className="text-xs text-gray-500">غائب</p></div>
          </div>
        ) : <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-3">أرصدة إجازاتي</h2>
        {balances.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">لا توجد أرصدة مخصّصة</p>
        ) : (
          <div className="space-y-2">
            {balances.slice(0, 4).map(b => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{b.leaveType.name}</span>
                <span className="font-bold text-blue-600">{b.entitledDays - b.usedDays} <span className="text-xs text-gray-400 font-normal">يوم</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════ حضوري ══════════ */
function AttendanceTab() {
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [data, setData]   = useState<{ logs: AttLog[]; summary: any } | null>(null)

  useEffect(() => {
    api.get(`/attendance/me/logs?month=${month}&year=${year}`).then(r => setData(r.data)).catch(() => {})
  }, [month, year])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm bg-white">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm bg-white">
          {[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-3 text-center"><p className="text-xl font-bold text-green-600">{data.summary.present}</p><p className="text-xs text-gray-500">حاضر</p></div>
          <div className="bg-white rounded-xl shadow-sm p-3 text-center"><p className="text-xl font-bold text-yellow-600">{data.summary.late}</p><p className="text-xs text-gray-500">متأخر</p></div>
          <div className="bg-white rounded-xl shadow-sm p-3 text-center"><p className="text-xl font-bold text-red-600">{data.summary.absent}</p><p className="text-xs text-gray-500">غائب</p></div>
          <div className="bg-white rounded-xl shadow-sm p-3 text-center"><p className="text-xl font-bold text-blue-600">{fmtMin(data.summary.totalOvertime)}</p><p className="text-xs text-gray-500">إضافي</p></div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {!data || data.logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">لا توجد سجلات حضور لهذا الشهر</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['التاريخ', 'الحالة', 'دخول', 'خروج', 'تأخير', 'إضافي'].map(h =>
                <th key={h} className="text-right px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {data.logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-600">{l.date ? fmtDate(l.date) : '—'}</td>
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_ATT[l.status]?.color ?? ''}`}>{STATUS_ATT[l.status]?.label ?? l.status}</span></td>
                  <td className="px-4 py-2.5 font-mono text-gray-700">{fmtTime(l.checkIn)}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-700">{fmtTime(l.checkOut)}</td>
                  <td className="px-4 py-2.5 text-red-600 text-xs">{fmtMin(l.lateMinutes)}</td>
                  <td className="px-4 py-2.5 text-green-600 text-xs">{fmtMin(l.overtimeMinutes ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ══════════ جدولي ══════════ */
function ScheduleTab() {
  const [entries, setEntries] = useState<SchedEntry[]>([])
  const [range] = useState({ start: localToday(), end: new Date(now.getTime() + 13 * 86400000).toISOString().slice(0, 10) })

  useEffect(() => {
    api.get(`/shifts/my-schedule?startDate=${range.start}&endDate=${range.end}`)
      .then(r => setEntries(r.data)).catch(() => {})
  }, [range])

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h2 className="font-semibold text-gray-700 mb-1">جدول شفتاتي — أسبوعان قادمان</h2>
      <p className="text-xs text-gray-400 mb-4">{fmtDate(range.start)} ← {fmtDate(range.end)}</p>
      {entries.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm">لا توجد شفتات مجدولة لك في هذه الفترة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => {
            const d = new Date(e.date)
            return (
              <div key={i} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50">
                <div className="text-center w-14 flex-shrink-0">
                  <p className="text-xs text-gray-400">{DAYS[d.getDay()]}</p>
                  <p className="font-bold text-gray-700">{d.getDate()}/{d.getMonth() + 1}</p>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-blue-700">{e.shiftName}</p>
                  <p className="text-xs text-gray-400 font-mono">{e.startTime} – {e.endTime}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ══════════ راتبي ══════════ */
function SalaryTab() {
  const [slips, setSlips] = useState<Payslip[]>([])
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => { api.get('/payroll/my').then(r => setSlips(r.data)).catch(() => {}) }, [])

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h2 className="font-semibold text-gray-700 mb-1">قسائم راتبي</h2>
      <p className="text-xs text-gray-400 mb-4">تظهر القسائم بعد اعتماد مسير الرواتب من الإدارة</p>
      {slips.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-3xl mb-2">💰</p>
          <p className="text-sm">لا توجد قسائم راتب معتمدة بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slips.map(s => (
            <div key={s.id} className="border border-gray-100 rounded-xl overflow-hidden">
              <button onClick={() => setOpen(o => o === s.id ? null : s.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                <span className="font-medium text-gray-700">{MONTHS[s.payrollRun.month - 1]} {s.payrollRun.year}</span>
                <span className="flex items-center gap-3">
                  <span className="font-bold text-green-600">{money(s.netSalary)} ر.س</span>
                  <span className="text-gray-300 text-xs">{open === s.id ? '▲' : '▼'}</span>
                </span>
              </button>
              {open === s.id && (
                <div className="px-4 py-3 bg-gray-50/70 border-t text-sm space-y-1.5">
                  <Row label="الراتب الأساسي" value={money(s.baseSalary)} />
                  <Row label="البدلات" value={`+ ${money(s.totalAllowances)}`} positive />
                  <Row label="الحسميات" value={`− ${money(s.totalDeductions)}`} negative />
                  {Number(s.absenceDeduction) > 0 && <Row label="خصم الغياب" value={`− ${money(s.absenceDeduction)}`} negative />}
                  {Number(s.lateDeduction) > 0 && <Row label="خصم التأخير" value={`− ${money(s.lateDeduction)}`} negative />}
                  <div className="border-t pt-1.5 mt-1.5">
                    <Row label="صافي الراتب" value={`${money(s.netSalary)} ر.س`} bold />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function Row({ label, value, positive, negative, bold }: { label: string; value: string; positive?: boolean; negative?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-semibold text-gray-800' : 'text-gray-500'}>{label}</span>
      <span className={`font-mono ${bold ? 'font-bold text-gray-900' : positive ? 'text-green-600' : negative ? 'text-red-500' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}

/* ══════════ إجازاتي ══════════ */
function LeavesTab({ userId }: { userId: string }) {
  const [balances, setBalances] = useState<Balance[]>([])
  const [types, setTypes]       = useState<LeaveType[]>([])
  const [requests, setRequests] = useState<LeaveReq[]>([])
  const [reqForm, setReqForm]   = useState({ leaveTypeId: '', startDate: '', endDate: '', notes: '' })
  const [reqOpen, setReqOpen]   = useState(false)
  const [busy, setBusy]         = useState(false)

  const loadRequests = () => api.get('/leaves/requests').then(r => setRequests(r.data)).catch(() => {})
  useEffect(() => {
    api.get(`/leaves/balances/${userId}`).then(r => setBalances(r.data)).catch(() => {})
    api.get('/leaves/types').then(r => setTypes(r.data)).catch(() => {})
    loadRequests()
  }, [userId])

  const submit = async () => {
    if (!reqForm.leaveTypeId || !reqForm.startDate || !reqForm.endDate) return
    setBusy(true)
    try { await api.post('/leaves/requests', reqForm); setReqForm({ leaveTypeId: '', startDate: '', endDate: '', notes: '' }); setReqOpen(false); loadRequests() }
    catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-3">أرصدة إجازاتي</h2>
        {balances.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">لا توجد أرصدة مخصّصة بعد</p> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {balances.map(b => (
              <div key={b.id} className="border border-gray-100 rounded-xl p-3">
                <p className="text-sm font-medium text-gray-700">{b.leaveType.name}</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{b.entitledDays - b.usedDays}<span className="text-sm text-gray-400 font-normal"> متبقٍ</span></p>
                <p className="text-xs text-gray-400 mt-0.5">من {b.entitledDays} · استُخدم {b.usedDays}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">طلبات إجازتي</h2>
          <button onClick={() => setReqOpen(v => !v)} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition">
            {reqOpen ? '✕ إلغاء' : '+ طلب إجازة'}
          </button>
        </div>
        {reqOpen && (
          <div className="border border-blue-100 rounded-xl p-4 mb-4 bg-blue-50/40">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <select value={reqForm.leaveTypeId} onChange={e => setReqForm(f => ({ ...f, leaveTypeId: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">— نوع الإجازة —</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input type="date" value={reqForm.startDate} onChange={e => setReqForm(f => ({ ...f, startDate: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm bg-white" />
              <input type="date" value={reqForm.endDate} onChange={e => setReqForm(f => ({ ...f, endDate: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <input value={reqForm.notes} onChange={e => setReqForm(f => ({ ...f, notes: e.target.value }))} placeholder="سبب الإجازة (اختياري)..." className="border rounded-lg px-3 py-2 text-sm bg-white w-full mb-3" />
            <button onClick={submit} disabled={busy || !reqForm.leaveTypeId || !reqForm.startDate || !reqForm.endDate}
              className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{busy ? '...' : 'إرسال الطلب'}</button>
          </div>
        )}
        {requests.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">لا توجد طلبات</p> : (
          <div className="divide-y">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">{r.leaveType.name}</p>
                  <p className="text-xs text-gray-400">{fmtDate(r.startDate)} ← {fmtDate(r.endDate)}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_REQ[r.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_REQ[r.status]?.label ?? r.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════ عهدتي وبدلتي ══════════ */
function CustodyTab() {
  const [custody, setCustody] = useState<CustodyItem[]>([])
  const [uniforms, setUniforms] = useState<UniformReq[]>([])
  const [uForm, setUForm] = useState({ uniformType: '', size: '', quantity: 1, notes: '' })
  const [uOpen, setUOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadUniforms = () => api.get('/uniforms/my').then(r => setUniforms(r.data)).catch(() => {})
  useEffect(() => {
    api.get('/custody/my').then(r => setCustody(r.data)).catch(() => {})
    loadUniforms()
  }, [])

  const submitUniform = async () => {
    if (!uForm.uniformType.trim()) return
    setBusy(true)
    try { await api.post('/uniforms', uForm); setUForm({ uniformType: '', size: '', quantity: 1, notes: '' }); setUOpen(false); loadUniforms() }
    catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {/* العهد */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-3">العهد المسندة إليّ</h2>
        {custody.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">لا توجد عهد مسجلة عليك</p> : (
          <div className="space-y-2">
            {custody.map(c => (
              <div key={c.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">📦 {c.itemName}</p>
                  <p className="text-xs text-gray-400">سُلّمت: {fmtDate(c.assignedDate)}{c.returnedDate ? ` · أُعيدت: ${fmtDate(c.returnedDate)}` : ''}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  {c.status === 'active' ? 'بعهدتك' : 'أُعيدت'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* طلبات البدلة */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">طلبات بدلة العمل</h2>
          <button onClick={() => setUOpen(v => !v)} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition">
            {uOpen ? '✕ إلغاء' : '+ طلب بدلة'}
          </button>
        </div>
        {uOpen && (
          <div className="border border-blue-100 rounded-xl p-4 mb-4 bg-blue-50/40">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input value={uForm.uniformType} onChange={e => setUForm(f => ({ ...f, uniformType: e.target.value }))} placeholder="نوع البدلة (قميص، بنطال...)" className="border rounded-lg px-3 py-2 text-sm bg-white" />
              <input value={uForm.size} onChange={e => setUForm(f => ({ ...f, size: e.target.value }))} placeholder="المقاس (S, M, L...)" className="border rounded-lg px-3 py-2 text-sm bg-white" />
              <input type="number" min={1} value={uForm.quantity} onChange={e => setUForm(f => ({ ...f, quantity: Number(e.target.value) }))} placeholder="الكمية" className="border rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <input value={uForm.notes} onChange={e => setUForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات (اختياري)..." className="border rounded-lg px-3 py-2 text-sm bg-white w-full mb-3" />
            <button onClick={submitUniform} disabled={busy || !uForm.uniformType.trim()}
              className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{busy ? '...' : 'إرسال الطلب'}</button>
          </div>
        )}
        {uniforms.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">لا توجد طلبات بدلة</p> : (
          <div className="divide-y">
            {uniforms.map(u => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">👔 {u.uniformType}{u.size ? ` · مقاس ${u.size}` : ''} · × {u.quantity}</p>
                  <p className="text-xs text-gray-400">{fmtDate(u.createdAt)}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_UNI[u.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_UNI[u.status]?.label ?? u.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════ موافقاتي — طلبات بانتظار قراري (رئيس قسم/مدير فرع/شؤون موظفين) ══════════ */
const REQ_TYPE_LABEL: Record<string, string> = { LEAVE: 'إجازة', UNIFORM: 'بدلة عمل', ONBOARDING: 'مباشرة' }
const REQ_TYPE_ICON: Record<string, string> = { LEAVE: '🌴', UNIFORM: '👔', ONBOARDING: '🚪' }

function QueueTab() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notesOpen, setNotesOpen] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const load = () => { setLoading(true); api.get('/approvals/my-queue').then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const endpointFor = (item: QueueItem) => {
    if (item.requestType === 'LEAVE') return `/leaves/requests/${item.requestId}/approve`
    if (item.requestType === 'UNIFORM') return `/uniforms/${item.requestId}/status`
    return `/onboarding/${item.requestId}/decide`
  }
  const bodyKeyFor = (item: QueueItem) => item.requestType === 'ONBOARDING' ? 'decision' : 'status'

  const decide = async (item: QueueItem, decision: 'APPROVED' | 'REJECTED') => {
    setBusyId(item.caseId)
    try {
      const key = bodyKeyFor(item)
      await api.put(endpointFor(item), { [key]: decision, notes: notes || undefined })
      setNotesOpen(null); setNotes('')
      load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setBusyId(null) }
  }

  if (loading) return <div className="text-center py-16" style={{ color: 'var(--ink-3)' }}>جارٍ التحميل...</div>

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
      <h2 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>طلبات بانتظار قراري</h2>
      <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--ink-3)' }}>تظهر هنا الطلبات التي وصلت دورك فيها ضمن مسار الاعتماد</p>
      {items.length === 0 ? (
        <div className="text-center py-10" style={{ color: 'var(--ink-3)' }}>
          <p className="text-3xl mb-2">✅</p>
          <p className="text-sm">لا توجد طلبات بانتظار قرارك حالياً</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.caseId} className="rounded-xl p-4" style={{ border: '1px solid var(--line)' }}>
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{REQ_TYPE_ICON[item.requestType]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {item.employee.fullName} <span className="font-normal" style={{ color: 'var(--ink-3)' }}>· {REQ_TYPE_LABEL[item.requestType]} · {item.title}</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{item.detail}</p>
                </div>
                <span className="text-xs rounded-full px-2.5 py-1 flex-shrink-0 tabular-nums"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
                  خطوتك <b style={{ color: 'var(--accent)' }}>{item.stepOrder}</b>‏/‏<b style={{ color: 'var(--accent)' }}>{item.totalSteps}</b> — {item.stepLabel}
                </span>
              </div>

              {notesOpen === item.caseId && (
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="ملاحظة (اختياري)..." autoFocus
                  className="w-full rounded-lg px-3 py-1.5 text-sm mt-3 outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
              )}

              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => decide(item, 'APPROVED')} disabled={busyId === item.caseId}
                  className="w-8 h-8 rounded-lg text-sm disabled:opacity-50" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}
                  aria-label="اعتماد" title="اعتماد">
                  {busyId === item.caseId ? '···' : '✓'}
                </button>
                <button onClick={() => decide(item, 'REJECTED')} disabled={busyId === item.caseId}
                  className="w-8 h-8 rounded-lg text-sm disabled:opacity-50" style={{ background: 'var(--crit-soft)', color: 'var(--crit)' }}
                  aria-label="رفض" title="رفض">
                  ✕
                </button>
                <button onClick={() => setNotesOpen(o => o === item.caseId ? null : item.caseId)}
                  className="text-xs px-2 py-1.5 rounded-lg" style={{ color: 'var(--ink-3)' }}>
                  {notesOpen === item.caseId ? 'إخفاء الملاحظة' : '+ إضافة ملاحظة'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════ مباشرتي — تعيين / عودة من إجازة ══════════ */
const ONBOARDING_LABEL: Record<string, string> = { NEW_HIRE: 'مباشرة تعيين', RETURN_FROM_LEAVE: 'مباشرة عودة من إجازة' }

function OnboardingTab() {
  const [items, setItems] = useState<OnboardingReq[]>([])
  const [form, setForm] = useState({ type: 'RETURN_FROM_LEAVE' as 'RETURN_FROM_LEAVE' | 'NEW_HIRE', scheduledDate: localToday(), notes: '' })
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/onboarding/my').then(r => setItems(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const submit = async () => {
    setBusy(true)
    try {
      await api.post('/onboarding', form)
      setForm({ type: 'RETURN_FROM_LEAVE', scheduledDate: localToday(), notes: '' })
      setOpen(false); load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setBusy(false) }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-gray-700">مباشرتي</h2>
          <p className="text-xs text-gray-400 mt-0.5">أرسل طلب مباشرة عودة من إجازة ليعتمده مسار الشركة</p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition">
          {open ? '✕ إلغاء' : '+ طلب مباشرة'}
        </button>
      </div>

      {open && (
        <div className="border border-blue-100 rounded-xl p-4 mb-4 bg-blue-50/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className="border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="RETURN_FROM_LEAVE">عودة من إجازة</option>
              <option value="NEW_HIRE">مباشرة تعيين</option>
            </select>
            <input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm bg-white" />
          </div>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات (اختياري)..." className="border rounded-lg px-3 py-2 text-sm bg-white w-full mb-3" />
          <button onClick={submit} disabled={busy} className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {busy ? '...' : 'إرسال الطلب'}
          </button>
        </div>
      )}

      {items.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">لا توجد طلبات مباشرة</p> : (
        <div className="divide-y">
          {items.map(r => (
            <div key={r.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-700">{ONBOARDING_LABEL[r.type]}</p>
                <p className="text-xs text-gray-400">{fmtDate(r.scheduledDate)}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_REQ[r.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_REQ[r.status]?.label ?? r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
