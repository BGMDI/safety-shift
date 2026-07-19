'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

interface Shift { id: string; name: string; startTime: string; endTime: string; breakMinutes: number; minStaffing: number | null; isNightShift: boolean; workingDays: number[]; branch?: { id: string; name: string } | null }
interface Employee { id: string; fullName: string; employeeCode: string }
interface BranchOpt { id: string; name: string }
interface ScheduleEntry { employeeId: string; employeeName: string; shiftName: string; date: string; startTime: string; endTime: string }

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export default function ShiftsPage() {
  useAuth()
  const [tab, setTab] = useState<'shifts' | 'assign' | 'rotation' | 'schedule'>('shifts')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<BranchOpt[]>([])
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [form, setForm] = useState({ name: '', branchId: '', startTime: '08:00', endTime: '17:00', breakMinutes: '60', minStaffing: '', isNightShift: false, workingDays: [0, 1, 2, 3, 4] })
  const [assign, setAssign] = useState({ employeeId: '', shiftId: '', effectiveFrom: new Date().toISOString().split('T')[0] })
  const [schedDates, setSchedDates] = useState({ start: new Date().toISOString().split('T')[0], end: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0] })
  const [loading, setLoading] = useState(false)

  const loadShifts = () => api.get('/shifts').then(r => setShifts(r.data)).catch(() => {})
  useEffect(() => {
    loadShifts()
    api.get('/employees?limit=500').then(r => setEmployees(r.data.data ?? r.data)).catch(() => {})
    api.get('/branches').then(r => {
      setBranches(r.data)
      // اختر أول فرع تلقائياً
      if (r.data.length > 0) setForm(f => f.branchId ? f : { ...f, branchId: r.data[0].id })
    }).catch(() => {})
  }, [])

  const toggleDay = (d: number) => {
    const wd = form.workingDays.includes(d) ? form.workingDays.filter(x => x !== d) : [...form.workingDays, d]
    setForm({ ...form, workingDays: wd })
  }

  const createShift = async () => {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      await api.post('/shifts', {
        ...form,
        branchId: form.branchId || undefined,
        breakMinutes: Number(form.breakMinutes),
        minStaffing: form.minStaffing ? Number(form.minStaffing) : undefined,
      })
      setForm({ ...form, name: '', startTime: '08:00', endTime: '17:00', breakMinutes: '60', minStaffing: '', isNightShift: false, workingDays: [0, 1, 2, 3, 4] })
      loadShifts()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    setLoading(false)
  }

  const assignShift = async () => {
    if (!assign.employeeId || !assign.shiftId) return
    setLoading(true)
    try {
      await api.post('/shifts/assign', { ...assign, effectiveFrom: new Date(assign.effectiveFrom) })
      alert('تم تعيين الشفت بنجاح')
    } catch (e: any) { alert(e.response?.data?.message) }
    setLoading(false)
  }

  const [schedLoading, setSchedLoading] = useState(false)
  const [schedSearched, setSchedSearched] = useState(false)

  const loadSchedule = async () => {
    setSchedLoading(true)
    try {
      const r = await api.get(`/shifts/schedule?startDate=${schedDates.start}&endDate=${schedDates.end}`)
      setSchedule(r.data)
      setSchedSearched(true)
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'حدث خطأ أثناء توليد الجدول')
    } finally { setSchedLoading(false) }
  }

  const byDate = schedule.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {} as Record<string, ScheduleEntry[]>)

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">جدولة الشفتات</h1>

      <div className="flex gap-2 mb-6 border-b">
        {[
          { id: 'shifts',   label: 'الشفتات' },
          { id: 'rotation', label: '🔄 خطط التدوير' },
          { id: 'assign',   label: 'تعيين موظف' },
          { id: 'schedule', label: 'الجدول التلقائي' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'shifts' && (
        <>
          <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
            <h2 className="font-semibold mb-4">إنشاء شفت جديد</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="text-xs text-gray-500 mb-1 block">اسم الشفت *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="شفت الصباح" className={inp} /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">الفرع *</label>
                <select value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })} className={inp}>
                  {branches.length === 0 && <option value="">— لا توجد فروع، أنشئ فرعاً أولاً</option>}
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">وقت البداية</label>
                <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className={inp} /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">وقت النهاية</label>
                <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className={inp} /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">استراحة (دقيقة)</label>
                <input type="number" value={form.breakMinutes} onChange={e => setForm({ ...form, breakMinutes: e.target.value })} className={inp} /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">الحد الأدنى للتغطية (عدد الموظفين)</label>
                <input type="number" min="0" placeholder="اختياري — لعرضه في لوحة التحكم" value={form.minStaffing} onChange={e => setForm({ ...form, minStaffing: e.target.value })} className={inp} /></div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-2 block">أيام العمل</label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${form.workingDays.includes(i) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" id="night" checked={form.isNightShift} onChange={e => setForm({ ...form, isNightShift: e.target.checked })} />
              <label htmlFor="night" className="text-sm">شفت ليلي</label>
            </div>
            <button onClick={createShift} disabled={loading || !form.name.trim()}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              + إنشاء شفت
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['الشفت', 'الفرع', 'البداية', 'النهاية', 'الاستراحة', 'الحد الأدنى', 'أيام العمل', 'نوع'].map(h =>
                  <th key={h} className="text-right px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {shifts.length === 0
                  ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">لا توجد شفتات</td></tr>
                  : shifts.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">
                        {s.branch
                          ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">{s.branch.name}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono">{s.startTime}</td>
                      <td className="px-4 py-3 font-mono">{s.endTime}</td>
                      <td className="px-4 py-3">{s.breakMinutes} د</td>
                      <td className="px-4 py-3">{s.minStaffing ? <span className="text-gray-700">{s.minStaffing} موظف</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                      <td className="px-4 py-3 text-xs">{s.workingDays.map(d => DAYS[d]).join('، ')}</td>
                      <td className="px-4 py-3">{s.isNightShift ? '🌙 ليلي' : '☀️ نهاري'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'rotation' && <RotationTab shifts={shifts} employees={employees} />}

      {tab === 'assign' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-4">تعيين موظف لشفت</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="text-xs text-gray-500 mb-1 block">الموظف *</label>
              <select value={assign.employeeId} onChange={e => setAssign({ ...assign, employeeId: e.target.value })} className={inp}>
                <option value="">-- اختر موظفاً --</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">الشفت *</label>
              <select value={assign.shiftId} onChange={e => setAssign({ ...assign, shiftId: e.target.value })} className={inp}>
                <option value="">-- اختر شفتاً --</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">تاريخ البداية</label>
              <input type="date" value={assign.effectiveFrom} onChange={e => setAssign({ ...assign, effectiveFrom: e.target.value })} className={inp} /></div>
          </div>
          <button onClick={assignShift} disabled={loading || !assign.employeeId || !assign.shiftId}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'جارٍ التعيين...' : 'تعيين الشفت'}
          </button>
        </div>
      )}

      {tab === 'schedule' && (
        <>
          <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
            <div className="flex gap-3 items-end flex-wrap">
              <div><label className="text-xs text-gray-500 mb-1 block">من</label>
                <input type="date" value={schedDates.start} onChange={e => setSchedDates({ ...schedDates, start: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">إلى</label>
                <input type="date" value={schedDates.end} onChange={e => setSchedDates({ ...schedDates, end: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" /></div>
              <button onClick={loadSchedule} disabled={schedLoading}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {schedLoading ? '⏳ جارٍ التوليد...' : '🔄 توليد الجدول'}
              </button>
            </div>
          </div>

          {Object.keys(byDate).sort().map(date => (
            <div key={date} className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <h3 className="font-semibold text-gray-700 mb-3">{new Date(date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
              <div className="flex flex-wrap gap-2">
                {byDate[date].map((e, i) => (
                  <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
                    <p className="font-medium text-blue-800">{e.employeeName}</p>
                    <p className="text-blue-600 text-xs">{e.shiftName} • {e.startTime}–{e.endTime}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(byDate).length === 0 && (
            schedSearched ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-12 text-gray-400">
                <p className="text-4xl mb-3">📅</p>
                <p className="font-medium text-gray-600">لا توجد تعيينات شفتات في هذه الفترة</p>
                <p className="text-sm mt-2 text-center leading-relaxed">
                  الجدول يُبنى من تعيينات الموظفين على الشفتات:<br />
                  عيّن موظفاً من تبويب <b>"تعيين موظف"</b> أو طبّق <b>"خطة تدوير"</b> ثم أعد التوليد
                </p>
              </div>
            ) : (
              <p className="text-center text-gray-400 py-10">اضغط "توليد الجدول" لعرض الجدول التلقائي</p>
            )
          )}
        </>
      )}
    </div>
  )
}
const inp = 'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full'

/* ══════════════════════════════════════════
   خطط تدوير الشفتات
══════════════════════════════════════════ */
interface RotMember { id: string; employee: { id: string; fullName: string; employeeCode: string } }
interface RotGroup { id: string; name: string; order: number; members: RotMember[] }
interface RotPlan {
  id: string; name: string
  shiftIds: string[]; rotateEveryDays: number
  restMode: string; restDays: number; weeklyRestDays: number[]
  startDate: string
  groups: RotGroup[]
}
interface PreviewData {
  startDate: string; days: number
  groups: { id: string; name: string; memberCount: number }[]
  matrix: { date: string; weekday: number; cells: (string | null)[] }[]
}

const SHIFT_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
]

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function RotationTab({ shifts, employees }: { shifts: Shift[]; employees: Employee[] }) {
  const [plans, setPlans] = useState<RotPlan[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  /* نموذج إنشاء خطة */
  const [form, setForm] = useState({
    name: '',
    shiftIds: [] as string[],
    rotateEveryDays: 3,
    restMode: 'AT_ROTATION',
    restDays: 1,
    weeklyRestDays: [] as number[],
    startDate: localToday(),
    groupCount: 0, // 0 = تلقائي
  })
  const [saving, setSaving] = useState(false)

  /* إضافة أعضاء */
  const [memberPick, setMemberPick] = useState<Record<string, string>>({})

  /* المعاينة */
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewPlan, setPreviewPlan] = useState<string | null>(null)
  const [previewDays, setPreviewDays] = useState(14)
  const [applying, setApplying] = useState(false)

  const shiftMap = useMemo(() => new Map(shifts.map(s => [s.id, s])), [shifts])
  const shiftColor = (id: string) => SHIFT_COLORS[shifts.findIndex(s => s.id === id) % SHIFT_COLORS.length]

  const load = () => api.get('/rotations').then(r => setPlans(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const suggestedGroups = form.shiftIds.length + (form.restMode === 'AT_ROTATION' && form.restDays > 0 ? 1 : 0)

  const toggleShift = (id: string) => {
    setForm(f => ({
      ...f,
      shiftIds: f.shiftIds.includes(id) ? f.shiftIds.filter(x => x !== id) : [...f.shiftIds, id],
    }))
  }

  const toggleRestDay = (d: number) => {
    setForm(f => ({
      ...f,
      weeklyRestDays: f.weeklyRestDays.includes(d) ? f.weeklyRestDays.filter(x => x !== d) : [...f.weeklyRestDays, d],
    }))
  }

  const createPlan = async () => {
    if (!form.name.trim() || !form.shiftIds.length) return
    setSaving(true)
    try {
      await api.post('/rotations', {
        ...form,
        groupCount: form.groupCount || suggestedGroups,
      })
      setForm({ name: '', shiftIds: [], rotateEveryDays: 3, restMode: 'AT_ROTATION', restDays: 1, weeklyRestDays: [], startDate: localToday(), groupCount: 0 })
      setShowCreate(false)
      load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setSaving(false) }
  }

  const deletePlan = async (p: RotPlan) => {
    if (!confirm(`حذف خطة "${p.name}"؟ (لن تُحذف تعيينات الشفتات المطبقة سابقاً)`)) return
    await api.delete(`/rotations/${p.id}`).catch((e: any) => alert(e.response?.data?.message ?? 'خطأ'))
    if (previewPlan === p.id) { setPreview(null); setPreviewPlan(null) }
    load()
  }

  const addMember = async (groupId: string) => {
    const empId = memberPick[groupId]
    if (!empId) return
    await api.post(`/rotations/groups/${groupId}/members`, { employeeIds: [empId] })
      .catch((e: any) => alert(e.response?.data?.message ?? 'خطأ'))
    setMemberPick(p => ({ ...p, [groupId]: '' }))
    load()
  }

  const removeMember = async (groupId: string, employeeId: string) => {
    await api.delete(`/rotations/groups/${groupId}/members/${employeeId}`).catch(() => {})
    load()
  }

  const distributeAll = async (plan: RotPlan) => {
    if (!employees.length) { alert('لا يوجد موظفون'); return }
    if (!confirm(`توزيع ${employees.length} موظف تلقائياً بالتساوي على ${plan.groups.length} مجموعات؟\nسيتم استبدال التوزيع الحالي.`)) return
    await api.post(`/rotations/${plan.id}/distribute`, { employeeIds: employees.map(e => e.id) })
      .catch((e: any) => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  const loadPreview = async (planId: string, days = previewDays) => {
    try {
      const r = await api.get(`/rotations/${planId}/preview?days=${days}`)
      setPreview(r.data)
      setPreviewPlan(planId)
    } catch (e: any) { alert(e.response?.data?.message ?? 'خطأ') }
  }

  const applyPlan = async (plan: RotPlan) => {
    const total = plan.groups.reduce((s, g) => s + g.members.length, 0)
    if (!total) { alert('أضف موظفين للمجموعات أولاً'); return }
    if (!confirm(`تطبيق الجدول لمدة 30 يوماً على ${total} موظف؟\n\nسيتم استبدال تعيينات الشفتات الحالية لهؤلاء الموظفين في هذه الفترة، وسيُحسب التأخير في الحضور بناءً على الجدول الجديد.`)) return
    setApplying(true)
    try {
      const r = await api.post(`/rotations/${plan.id}/apply`, { days: 30 })
      alert(`✓ تم تطبيق الجدول\nالفترة: ${r.data.from} → ${r.data.to}\nالموظفون: ${r.data.employees} · التعيينات: ${r.data.applied}`)
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setApplying(false) }
  }

  const restLabel = (p: RotPlan) =>
    p.restMode === 'WEEKLY'
      ? `راحة أسبوعية: ${p.weeklyRestDays.map(d => DAYS[d]).join('، ') || '—'}`
      : `راحة ${p.restDays} يوم عند القلبة`

  return (
    <div className="space-y-4">

      {/* رأس + زر إنشاء */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          وزّع الموظفين مجموعات، وحدد نظام القلب والراحة — والنظام يولّد الجدول ويطبقه
        </p>
        <button onClick={() => setShowCreate(v => !v)}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition">
          {showCreate ? '✕ إلغاء' : '+ خطة تدوير جديدة'}
        </button>
      </div>

      {/* نموذج إنشاء خطة */}
      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">اسم الخطة *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="تدوير الأمن، تدوير المصنع..." className={inp} autoFocus />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">تاريخ بداية الخطة</label>
              <input type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} />
            </div>
          </div>

          {/* اختيار الشفتات بالترتيب */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">
              الشفتات في الدورة * <span className="text-gray-400">(انقر بالترتيب الذي تتقلب فيه المجموعات)</span>
            </label>
            {shifts.length === 0 ? (
              <p className="text-xs text-red-500">أنشئ الشفتات أولاً من تبويب "الشفتات"</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {shifts.map(s => {
                  const idx = form.shiftIds.indexOf(s.id)
                  return (
                    <button key={s.id} onClick={() => toggleShift(s.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                        idx >= 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                      {idx >= 0 && <span className="inline-block bg-white/25 rounded-full w-4 h-4 text-center leading-4 ml-1">{idx + 1}</span>}
                      {s.name} ({s.startTime}–{s.endTime})
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">قلب الشفت كل (أيام)</label>
              <input type="number" min={1} max={30} value={form.rotateEveryDays}
                onChange={e => setForm(f => ({ ...f, rotateEveryDays: Number(e.target.value) }))} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">نظام الراحة</label>
              <select value={form.restMode} onChange={e => setForm(f => ({ ...f, restMode: e.target.value }))} className={inp}>
                <option value="AT_ROTATION">راحة عند قلبة الشفت</option>
                <option value="WEEKLY">راحة أسبوعية (أيام ثابتة)</option>
              </select>
            </div>
            {form.restMode === 'AT_ROTATION' ? (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">أيام الراحة عند القلبة</label>
                <input type="number" min={0} max={7} value={form.restDays}
                  onChange={e => setForm(f => ({ ...f, restDays: Number(e.target.value) }))} className={inp} />
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">عدد المجموعات</label>
                <input type="number" min={1} max={8} value={form.groupCount || suggestedGroups}
                  onChange={e => setForm(f => ({ ...f, groupCount: Number(e.target.value) }))} className={inp} />
              </div>
            )}
          </div>

          {form.restMode === 'WEEKLY' && (
            <div>
              <label className="text-xs text-gray-500 mb-2 block">أيام الراحة الأسبوعية</label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleRestDay(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      form.weeklyRestDays.includes(i) ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.restMode === 'AT_ROTATION' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">عدد المجموعات</label>
                <input type="number" min={1} max={8} value={form.groupCount || suggestedGroups}
                  onChange={e => setForm(f => ({ ...f, groupCount: Number(e.target.value) }))} className={inp} />
              </div>
              <div className="flex items-end">
                <p className="text-xs text-gray-400 pb-2">
                  💡 لأفضل تغطية: مجموعات = شفتات + 1، وراحة = أيام القلبة
                </p>
              </div>
            </div>
          )}

          <button onClick={createPlan} disabled={saving || !form.name.trim() || !form.shiftIds.length}
            className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? '⏳ جارٍ الإنشاء...' : '✓ إنشاء الخطة'}
          </button>
        </div>
      )}

      {/* قائمة الخطط */}
      {plans.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-14 text-gray-400">
          <p className="text-4xl mb-3">🔄</p>
          <p className="font-medium">لا توجد خطط تدوير</p>
          <p className="text-sm mt-1">أنشئ خطة لتوزيع الموظفين على الشفتات بالتناوب</p>
        </div>
      ) : plans.map(plan => {
        const totalMembers = plan.groups.reduce((s, g) => s + g.members.length, 0)
        const isOpen = expanded === plan.id
        return (
          <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

            {/* رأس الخطة */}
            <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/50"
              onClick={() => setExpanded(isOpen ? null : plan.id)}>
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">🔄</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800">{plan.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {plan.shiftIds.map(id => shiftMap.get(id)?.name ?? '؟').join(' ← ')}
                  {' · '}قلب كل {plan.rotateEveryDays} أيام · {restLabel(plan)}
                </p>
              </div>
              <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-lg font-medium flex-shrink-0">
                {plan.groups.length} مجموعات · {totalMembers} موظف
              </span>
              <span className="text-gray-300 text-xs">{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* تفاصيل الخطة */}
            {isOpen && (
              <div className="border-t border-gray-50 px-5 py-4 space-y-4">

                {/* أزرار الإجراءات */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => distributeAll(plan)}
                    className="bg-purple-50 text-purple-700 text-xs px-3 py-2 rounded-lg hover:bg-purple-100 transition">
                    ⚡ توزيع كل الموظفين تلقائياً
                  </button>
                  <button onClick={() => loadPreview(plan.id)}
                    className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg hover:bg-blue-100 transition">
                    👁️ معاينة الجدول
                  </button>
                  <button onClick={() => applyPlan(plan)} disabled={applying}
                    className="bg-green-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                    {applying ? '⏳...' : '✓ تطبيق الجدول (30 يوم)'}
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => deletePlan(plan)}
                    className="text-red-400 hover:text-red-600 text-xs px-3 py-2 rounded-lg hover:bg-red-50 transition">
                    حذف الخطة
                  </button>
                </div>

                {/* المجموعات */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {plan.groups.map((g, gi) => (
                    <div key={g.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-gray-700">{g.name}</p>
                        <span className="text-xs text-gray-400">{g.members.length}</span>
                      </div>
                      <div className="space-y-1 mb-2 max-h-44 overflow-y-auto">
                        {g.members.map(m => (
                          <div key={m.id} className="group flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 text-xs">
                            <span className="flex-1 text-gray-700 truncate">{m.employee.fullName}</span>
                            <button onClick={() => removeMember(g.id, m.employee.id)}
                              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">✕</button>
                          </div>
                        ))}
                        {g.members.length === 0 && <p className="text-xs text-gray-300 text-center py-2">فارغة</p>}
                      </div>
                      <div className="flex gap-1">
                        <select value={memberPick[g.id] ?? ''}
                          onChange={e => setMemberPick(p => ({ ...p, [g.id]: e.target.value }))}
                          className="flex-1 border rounded-lg px-1.5 py-1 text-xs bg-white min-w-0">
                          <option value="">+ إضافة موظف...</option>
                          {employees
                            .filter(e => !plan.groups.some(gg => gg.members.some(m => m.employee.id === e.id)))
                            .map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                        </select>
                        <button onClick={() => addMember(g.id)} disabled={!memberPick[g.id]}
                          className="bg-blue-600 text-white text-xs px-2 rounded-lg disabled:opacity-40">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* المعاينة */}
                {preview && previewPlan === plan.id && (
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b">
                      <p className="text-sm font-semibold text-gray-700">📅 معاينة الجدول من {preview.startDate}</p>
                      <div className="flex-1" />
                      {[7, 14, 30].map(d => (
                        <button key={d} onClick={() => { setPreviewDays(d); loadPreview(plan.id, d) }}
                          className={`text-xs px-2.5 py-1 rounded-lg transition ${
                            previewDays === d ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border hover:bg-gray-50'}`}>
                          {d} يوم
                        </button>
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-right px-3 py-2 font-medium text-gray-600 whitespace-nowrap">اليوم</th>
                            {preview.groups.map(g => (
                              <th key={g.id} className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                                {g.name} <span className="text-gray-400">({g.memberCount})</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {preview.matrix.map(row => (
                            <tr key={row.date} className={row.weekday === 5 || row.weekday === 6 ? 'bg-gray-50/60' : ''}>
                              <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                                <span className="font-medium">{DAYS[row.weekday]}</span>
                                <span className="text-gray-400 mr-1 font-mono">{row.date.slice(5)}</span>
                              </td>
                              {row.cells.map((cell, ci) => (
                                <td key={ci} className="px-2 py-1.5 text-center">
                                  {cell ? (
                                    <span className={`inline-block px-2 py-1 rounded-lg font-medium ${shiftColor(cell)}`}>
                                      {shiftMap.get(cell)?.name ?? '؟'}
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-1 rounded-lg bg-gray-100 text-gray-400">راحة</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
