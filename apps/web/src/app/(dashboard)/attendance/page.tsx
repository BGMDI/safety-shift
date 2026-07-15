'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

/* ══════════ الأنواع ══════════ */
interface AttLog {
  id: string; date: string; checkIn: string | null; checkOut: string | null
  status: string; source: string; lateMinutes: number; overtimeMinutes: number; notes: string | null
}
interface RosterRow {
  id: string; fullName: string; employeeCode: string
  branch: { name: string } | null
  department: { name: string } | null
  log: AttLog | null
}
interface Employee { id: string; fullName: string; employeeCode: string }
interface Branch { id: string; name: string }
interface Dept { id: string; name: string }
interface SummaryRow {
  employeeId: string; fullName: string; employeeCode: string
  present: number; absent: number; late: number; excused: number
  totalLate: number; totalOvertime: number
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PRESENT:  { label: 'حاضر',   color: 'bg-green-100 text-green-700' },
  ABSENT:   { label: 'غائب',   color: 'bg-red-100 text-red-700' },
  LATE:     { label: 'متأخر',  color: 'bg-yellow-100 text-yellow-700' },
  EXCUSED:  { label: 'بعذر',   color: 'bg-blue-100 text-blue-700' },
  HOLIDAY:  { label: 'إجازة',  color: 'bg-purple-100 text-purple-700' },
  WEEKEND:  { label: 'عطلة',   color: 'bg-gray-100 text-gray-600' },
}

const SOURCE_MAP: Record<string, string> = {
  MANUAL: 'يدوي', SUPERVISOR: 'مشرف', SELF: 'ذاتي', BIOMETRIC: 'بصمة',
}

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtTime = (dt: string | null) =>
  dt ? new Date(dt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'

const toTimeInput = (dt: string | null) => (dt ? new Date(dt).toTimeString().slice(0, 5) : '')

const fmtMinutes = (min: number) => {
  if (min <= 0) return '—'
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}س ${m}د` : `${m}د`
}

const inp = 'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full bg-white'

/* ══════════ الصفحة ══════════ */
export default function AttendancePage() {
  useAuth()
  const [tab, setTab] = useState<'roster' | 'summary' | 'import' | 'record'>('roster')

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-4">الحضور والانصراف</h1>

      <SelfCheckCard />

      <div className="flex gap-2 mb-6 border-b">
        {[
          { id: 'roster',  label: '📋 كشف التحضير' },
          { id: 'summary', label: '📊 الملخص الشهري' },
          { id: 'import',  label: '📥 استيراد بصمة' },
          { id: 'record',  label: '✍️ تسجيل يدوي' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'roster'  && <RosterTab />}
      {tab === 'summary' && <SummaryTab />}
      {tab === 'import'  && <ImportTab />}
      {tab === 'record'  && <RecordTab />}
    </div>
  )
}

/* ══════════ بطاقة التحضير الذاتي ══════════ */
function SelfCheckCard() {
  const [myLog, setMyLog] = useState<AttLog | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/attendance/me/today').then(r => setMyLog(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const check = async (type: 'in' | 'out') => {
    setBusy(true)
    try {
      await api.post('/attendance/self-check', { type })
      load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setBusy(false) }
  }

  return (
    <div className="bg-gradient-to-l from-blue-600 to-blue-500 rounded-xl shadow-sm p-4 mb-6 flex items-center gap-4 text-white">
      <div className="text-3xl">🕐</div>
      <div className="flex-1">
        <p className="font-semibold">تحضيري اليوم</p>
        <p className="text-blue-100 text-sm mt-0.5">
          {myLog?.checkIn
            ? <>حضور: {fmtTime(myLog.checkIn)}{myLog.checkOut ? ` · انصراف: ${fmtTime(myLog.checkOut)}` : ''}
               {myLog.lateMinutes > 0 ? ` · تأخير ${fmtMinutes(myLog.lateMinutes)}` : ''}</>
            : 'لم تسجل حضورك بعد'}
        </p>
      </div>
      {!myLog?.checkIn && (
        <button onClick={() => check('in')} disabled={busy}
          className="bg-white text-blue-700 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition">
          {busy ? '...' : '✓ تسجيل حضور'}
        </button>
      )}
      {myLog?.checkIn && !myLog?.checkOut && (
        <button onClick={() => check('out')} disabled={busy}
          className="bg-white/15 border border-white/40 text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-white/25 disabled:opacity-50 transition">
          {busy ? '...' : '🚪 تسجيل انصراف'}
        </button>
      )}
      {myLog?.checkIn && myLog?.checkOut && (
        <span className="bg-white/15 text-sm px-4 py-2 rounded-lg">✓ اكتمل يومك</span>
      )}
    </div>
  )
}

/* ══════════ تبويب كشف التحضير ══════════ */
function RosterTab() {
  const [roster, setRoster]       = useState<RosterRow[]>([])
  const [date, setDate]           = useState(localToday())
  const [branchId, setBranchId]   = useState('')
  const [deptId, setDeptId]       = useState('')
  const [branches, setBranches]   = useState<Branch[]>([])
  const [depts, setDepts]         = useState<Dept[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading]     = useState(true)
  const [bulkBusy, setBulkBusy]   = useState(false)

  const [editId, setEditId]       = useState<string | null>(null)
  const [editForm, setEditForm]   = useState({ checkIn: '', checkOut: '', status: 'PRESENT', notes: '' })

  const load = () => {
    setLoading(true)
    const p = new URLSearchParams({ date })
    if (branchId) p.set('branchId', branchId)
    if (deptId) p.set('departmentId', deptId)
    api.get(`/attendance/roster?${p}`).then(r => setRoster(r.data)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    api.get('/branches').then(r => setBranches(r.data)).catch(() => {})
    api.get('/departments').then(r => setDepts(r.data)).catch(() => {})
  }, [])
  useEffect(() => { load() }, [date, branchId, deptId])

  const stats = useMemo(() => ({
    total:      roster.length,
    present:    roster.filter(r => r.log?.status === 'PRESENT').length,
    late:       roster.filter(r => r.log?.status === 'LATE').length,
    absent:     roster.filter(r => r.log?.status === 'ABSENT').length,
    unrecorded: roster.filter(r => !r.log).length,
  }), [roster])

  const visible = useMemo(() => roster.filter(r => {
    if (!statusFilter) return true
    if (statusFilter === 'NONE') return !r.log
    return r.log?.status === statusFilter
  }), [roster, statusFilter])

  const quickMark = async (employeeId: string, status: string) => {
    await api.post('/attendance', { employeeId, date, status, source: 'MANUAL' })
      .catch((e: any) => alert(e.response?.data?.message ?? 'حدث خطأ'))
    load()
  }

  const bulkPresent = async () => {
    const ids = roster.filter(r => !r.log).map(r => r.id)
    if (!ids.length) return
    if (!confirm(`تحضير ${ids.length} موظف كـ"حاضر"؟`)) return
    setBulkBusy(true)
    try {
      const r = await api.post('/attendance/bulk', { date, employeeIds: ids, status: 'PRESENT' })
      alert(`تم تحضير ${r.data.marked} موظف`)
      load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setBulkBusy(false) }
  }

  const startEdit = (row: RosterRow) => {
    if (!row.log) return
    setEditId(row.log.id)
    setEditForm({
      checkIn: toTimeInput(row.log.checkIn),
      checkOut: toTimeInput(row.log.checkOut),
      status: row.log.status,
      notes: row.log.notes ?? '',
    })
  }

  const saveEdit = async (logId: string) => {
    await api.put(`/attendance/${logId}`, {
      checkIn: editForm.checkIn || null,
      checkOut: editForm.checkOut || null,
      status: editForm.status,
      notes: editForm.notes,
    }).catch((e: any) => alert(e.response?.data?.message ?? 'حدث خطأ'))
    setEditId(null)
    load()
  }

  const removeLog = async (logId: string) => {
    if (!confirm('حذف السجل؟ سيُسجَّل الحذف في سجل التدقيق.')) return
    await api.delete(`/attendance/${logId}`).catch((e: any) => alert(e.response?.data?.message ?? 'حدث خطأ'))
    load()
  }

  const cards = [
    { key: '',        label: 'الإجمالي',    value: stats.total,      color: 'text-gray-700',   bg: 'bg-white' },
    { key: 'PRESENT', label: '✅ حاضر',      value: stats.present,    color: 'text-green-600',  bg: 'bg-green-50' },
    { key: 'LATE',    label: '⏰ متأخر',     value: stats.late,       color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { key: 'ABSENT',  label: '❌ غائب',      value: stats.absent,     color: 'text-red-600',    bg: 'bg-red-50' },
    { key: 'NONE',    label: '⬜ لم يُحضَّر', value: stats.unrecorded, color: 'text-gray-500',   bg: 'bg-gray-50' },
  ]

  return (
    <div>
      {/* الفلاتر */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <select value={branchId} onChange={e => setBranchId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="">كل الفروع</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={deptId} onChange={e => setDeptId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="">كل الأقسام</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="flex-1" />
        {stats.unrecorded > 0 && (
          <button onClick={bulkPresent} disabled={bulkBusy}
            className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {bulkBusy ? '⏳ جارٍ...' : `✓ تحضير الباقي حاضر (${stats.unrecorded})`}
          </button>
        )}
      </div>

      {/* بطاقات الإحصاء */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {cards.map(c => (
          <button key={c.key} onClick={() => setStatusFilter(f => f === c.key ? '' : c.key)}
            className={`${c.bg} rounded-xl p-3 text-center border transition ${
              statusFilter === c.key ? 'border-blue-400 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-200'}`}>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </button>
        ))}
      </div>

      {/* الجدول */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">جارٍ التحميل...</div>
        ) : visible.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400">لا يوجد موظفون مطابقون</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['الموظف', 'الفرع / القسم', 'الحالة', 'دخول', 'خروج', 'تأخير', 'إضافي', 'المصدر', ''].map(h =>
                <th key={h} className="text-right px-3 py-3 font-medium text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {visible.map(r => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <p className="font-medium">{r.fullName}</p>
                      <p className="text-gray-400 text-xs">{r.employeeCode}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {r.branch?.name ?? '—'}{r.department ? ` / ${r.department.name}` : ''}
                    </td>

                    {r.log ? (
                      <>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_MAP[r.log.status]?.color ?? ''}`}>
                            {STATUS_MAP[r.log.status]?.label ?? r.log.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-gray-700">{fmtTime(r.log.checkIn)}</td>
                        <td className="px-3 py-3 font-mono text-gray-700">{fmtTime(r.log.checkOut)}</td>
                        <td className="px-3 py-3 text-center">
                          {r.log.lateMinutes > 0 ? <span className="text-red-600 text-xs">{fmtMinutes(r.log.lateMinutes)}</span> : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {r.log.overtimeMinutes > 0 ? <span className="text-green-600 text-xs">{fmtMinutes(r.log.overtimeMinutes)}</span> : '—'}
                        </td>
                        <td className="px-3 py-3 text-gray-400 text-xs">{SOURCE_MAP[r.log.source] ?? r.log.source}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => startEdit(r)}
                              className="text-blue-600 text-xs px-2 py-1 rounded hover:bg-blue-50">✎ تعديل</button>
                            <button onClick={() => removeLog(r.log!.id)}
                              className="text-red-500 text-xs px-2 py-1 rounded hover:bg-red-50">حذف</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-3">
                          <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-400">لم يُحضَّر</span>
                        </td>
                        <td className="px-3 py-3 text-gray-300">—</td>
                        <td className="px-3 py-3 text-gray-300">—</td>
                        <td className="px-3 py-3 text-center text-gray-300">—</td>
                        <td className="px-3 py-3 text-center text-gray-300">—</td>
                        <td className="px-3 py-3 text-gray-300">—</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => quickMark(r.id, 'PRESENT')}
                              className="bg-green-50 text-green-700 text-xs px-2.5 py-1 rounded-lg hover:bg-green-100">✓ حاضر</button>
                            <button onClick={() => quickMark(r.id, 'ABSENT')}
                              className="bg-red-50 text-red-600 text-xs px-2.5 py-1 rounded-lg hover:bg-red-100">✗ غائب</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>

                  {/* صف التعديل */}
                  {r.log && editId === r.log.id && (
                    <tr className="bg-blue-50/50">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">الدخول</label>
                            <input type="time" value={editForm.checkIn}
                              onChange={e => setEditForm(f => ({ ...f, checkIn: e.target.value }))}
                              className="border rounded-lg px-2 py-1.5 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">الخروج</label>
                            <input type="time" value={editForm.checkOut}
                              onChange={e => setEditForm(f => ({ ...f, checkOut: e.target.value }))}
                              className="border rounded-lg px-2 py-1.5 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">الحالة</label>
                            <select value={editForm.status}
                              onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                              className="border rounded-lg px-2 py-1.5 text-sm bg-white">
                              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </div>
                          <div className="flex-1 min-w-40">
                            <label className="text-xs text-gray-500 block mb-1">ملاحظات</label>
                            <input value={editForm.notes}
                              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                              className="border rounded-lg px-2 py-1.5 text-sm bg-white w-full" />
                          </div>
                          <button onClick={() => saveEdit(r.log!.id)}
                            className="bg-green-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-green-700">✓ حفظ</button>
                          <button onClick={() => setEditId(null)}
                            className="border text-gray-500 text-xs px-3 py-2 rounded-lg hover:bg-gray-50">إلغاء</button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          التأخير والوقت الإضافي يُحسبان تلقائياً من شفت الموظف بعد الحفظ — والتعديل يُسجَّل في سجل التدقيق
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ══════════ تبويب الملخص الشهري ══════════ */
function SummaryTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [rows, setRows]   = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/attendance/summary?month=${month}&year=${year}`)
      .then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [month, year])

  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          {[year - 2, year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map(y =>
            <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-sm text-gray-500">{rows.length} موظف</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📊</p>
            <p>لا توجد سجلات لهذا الشهر</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['الموظف', 'حاضر', 'متأخر', 'غائب', 'بعذر', 'إجمالي التأخير', 'الوقت الإضافي'].map(h =>
                <th key={h} className="text-right px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr key={r.employeeId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.fullName}</p>
                    <p className="text-gray-400 text-xs">{r.employeeCode}</p>
                  </td>
                  <td className="px-4 py-3"><span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs">{r.present}</span></td>
                  <td className="px-4 py-3"><span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full text-xs">{r.late}</span></td>
                  <td className="px-4 py-3"><span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-xs">{r.absent}</span></td>
                  <td className="px-4 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">{r.excused}</span></td>
                  <td className="px-4 py-3 text-red-600 text-xs">{fmtMinutes(r.totalLate)}</td>
                  <td className="px-4 py-3 text-green-600 text-xs">{fmtMinutes(r.totalOvertime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ══════════ تبويب استيراد بصمة ══════════ */
interface ImportRow { employeeCode: string; date: string; checkIn?: string; checkOut?: string }

function ImportTab() {
  const [rows, setRows]         = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult]     = useState<{ imported: number; skipped: Array<{ row: number; reason: string }> } | null>(null)

  const parseCsv = (text: string): ImportRow[] => {
    const out: ImportRow[] = []
    for (const line of text.trim().split(/\r?\n/)) {
      const cols = line.split(/[,;\t]/).map(s => s.trim())
      if (cols.length < 2 || !cols[0]) continue
      if (/رقم|code|employee/i.test(cols[0])) continue // سطر العناوين
      let [employeeCode, date, checkIn, checkOut] = cols
      const dm = date?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (dm) date = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`
      out.push({ employeeCode, date, checkIn: checkIn || undefined, checkOut: checkOut || undefined })
    }
    return out
  }

  const onFile = async (f: File | null) => {
    setResult(null)
    if (!f) { setRows([]); setFileName(''); return }
    setFileName(f.name)
    setRows(parseCsv(await f.text()))
  }

  const doImport = async () => {
    if (!rows.length) return
    setImporting(true)
    try {
      const r = await api.post('/attendance/import', { rows })
      setResult(r.data)
      setRows([])
      setFileName('')
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setImporting(false) }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold mb-2">استيراد سجلات جهاز البصمة</h2>
        <p className="text-sm text-gray-500 mb-4">
          صدّر السجلات من جهاز البصمة بصيغة CSV (من Excel: حفظ باسم ← CSV) بالأعمدة التالية بالترتيب:
        </p>
        <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 mb-4" dir="ltr">
          employeeCode, date, checkIn, checkOut<br />
          EMP001, 2026-07-06, 08:05, 17:10<br />
          EMP002, 06/07/2026, 07:58, 17:00
        </div>
        <p className="text-xs text-gray-400 mb-4">
          التاريخ: YYYY-MM-DD أو DD/MM/YYYY · الوقت بصيغة 24 ساعة · التأخير والإضافي يُحسبان تلقائياً من شفت كل موظف
        </p>

        <input type="file" accept=".csv,.txt" onChange={e => onFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-500 file:ml-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm hover:file:bg-blue-100 file:cursor-pointer" />

        {rows.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">
              📄 {fileName} — تم قراءة <b>{rows.length}</b> صف
            </p>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 mb-3" dir="ltr">
              {rows.slice(0, 5).map((r, i) => (
                <p key={i} className="font-mono">{r.employeeCode} · {r.date} · {r.checkIn ?? '—'} → {r.checkOut ?? '—'}</p>
              ))}
              {rows.length > 5 && <p className="mt-1 text-gray-400">... و{rows.length - 5} صف إضافي</p>}
            </div>
            <button onClick={doImport} disabled={importing}
              className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {importing ? '⏳ جارٍ الاستيراد...' : `📥 استيراد ${rows.length} سجل`}
            </button>
          </div>
        )}
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-green-600 font-medium mb-2">✓ تم استيراد {result.imported} سجل بنجاح</p>
          {result.skipped.length > 0 && (
            <>
              <p className="text-sm text-red-500 mb-2">تم تخطي {result.skipped.length} صف:</p>
              <div className="bg-red-50 rounded-lg p-3 text-xs text-red-600 max-h-40 overflow-y-auto">
                {result.skipped.map((s, i) => <p key={i}>صف {s.row}: {s.reason}</p>)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════ تبويب التسجيل اليدوي ══════════ */
function RecordTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({
    employeeId: '', date: localToday(), checkIn: '', checkOut: '',
    status: 'PRESENT', source: 'MANUAL', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/employees?limit=500').then(r => setEmployees(r.data.data ?? r.data)).catch(() => {})
  }, [])

  const record = async () => {
    if (!form.employeeId || !form.date) return
    setLoading(true)
    setSaved(false)
    try {
      await api.post('/attendance', form)
      setForm({ ...form, employeeId: '', checkIn: '', checkOut: '', notes: '' })
      setSaved(true)
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 max-w-2xl">
      <h2 className="font-semibold mb-1">تسجيل حضور / انصراف يدوي</h2>
      <p className="text-xs text-gray-400 mb-4">التأخير والوقت الإضافي يُحسبان تلقائياً من شفت الموظف</p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">الموظف *</label>
          <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className={inp}>
            <option value="">-- اختر موظفاً --</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">التاريخ *</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inp} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">وقت الدخول</label>
          <input type="time" value={form.checkIn} onChange={e => setForm({ ...form, checkIn: e.target.value })} className={inp} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">وقت الخروج</label>
          <input type="time" value={form.checkOut} onChange={e => setForm({ ...form, checkOut: e.target.value })} className={inp} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">الحالة</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inp}>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">المصدر</label>
          <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className={inp}>
            {Object.entries(SOURCE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-4">
        <label className="text-xs text-gray-500 mb-1 block">ملاحظات</label>
        <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
          placeholder="ملاحظات اختيارية..." className={inp} />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={record} disabled={loading || !form.employeeId}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'جارٍ الحفظ...' : '✅ تسجيل الحضور'}
        </button>
        {saved && <span className="text-green-600 text-sm">✓ تم الحفظ</span>}
      </div>
    </div>
  )
}
