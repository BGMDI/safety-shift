'use client'
import { useState, useEffect, useRef } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

/* ── أنواع البيانات ──────────────────────────────── */
type CalcType = 'FIXED' | 'SENIORITY_BASED' | 'SICK_TIERED' | 'ONCE_PER_EMPLOYMENT' | 'PER_EVENT'

interface LeaveType {
  id: string; name: string; description?: string
  maxDays: number; maxDaysHalfPay?: number; maxDaysUnpaid?: number
  requiresApproval: boolean; color?: string; isSystemDefault: boolean
  calculationType: CalcType; minDays?: number; seniorityThreshold?: number
  _count: { leaveRequests: number }
}
interface LeaveBalance {
  id: string; year: number; entitledDays: number; usedDays: number
  leaveType: { name: string; maxDays: number }
}
interface LeaveRequest {
  id: string; startDate: string; endDate: string; status: string; notes: string | null
  employee: { fullName: string; employeeCode: string }
  leaveType: { name: string }
}
interface Employee { id: string; fullName: string; employeeCode: string }

/* ── ثوابت ────────────────────────────────────────── */
const STATUS: Record<string, { label: string; color: string }> = {
  PENDING:  { label: 'معلق',  color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: 'مقبول', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'مرفوض', color: 'bg-red-100 text-red-700' },
}

/** وصف طريقة الاحتساب */
const CALC_INFO: Record<CalcType, { label: string; badge: string; desc: string }> = {
  FIXED:               { label: 'ثابت',        badge: 'bg-blue-50 text-blue-700',    desc: 'نفس عدد الأيام لجميع الموظفين' },
  SENIORITY_BASED:     { label: 'حسب الأقدمية', badge: 'bg-purple-50 text-purple-700', desc: 'يتغير تلقائياً بحسب سنوات الخدمة' },
  SICK_TIERED:         { label: 'متدرّج',       badge: 'bg-orange-50 text-orange-700', desc: 'براتب كامل ثم نصف راتب ثم بدون راتب' },
  ONCE_PER_EMPLOYMENT: { label: 'مرة بالخدمة',  badge: 'bg-yellow-50 text-yellow-700', desc: 'تُمنح مرة واحدة فقط طوال الخدمة' },
  PER_EVENT:           { label: 'عند الحدث',    badge: 'bg-pink-50 text-pink-700',     desc: 'تُضاف عند وقوع الحدث، لا تُحتسب تلقائياً' },
}

const COLORS = ['#3B82F6','#EF4444','#EC4899','#8B5CF6','#F59E0B','#10B981','#06B6D4','#F97316','#6366F1','#6B7280']
const thisYear = new Date().getFullYear()
const inp = 'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full'

type Tab = 'types' | 'balances' | 'requests'
const EMPTY_FORM = {
  name: '', description: '', maxDays: '', maxDaysHalfPay: '', maxDaysUnpaid: '',
  requiresApproval: true, color: '#3B82F6',
  calculationType: 'FIXED' as CalcType, minDays: '', seniorityThreshold: '5',
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function LeavesPage() {
  useAuth()
  const [tab, setTab] = useState<Tab>('types')

  /* أنواع الإجازات */
  const [types, setTypes]               = useState<LeaveType[]>([])
  const [showForm, setShowForm]         = useState(false)
  const [editId, setEditId]             = useState<string | null>(null)
  const [form, setForm]                 = useState({ ...EMPTY_FORM })
  const [saving, setSaving]             = useState(false)
  const [seeding, setSeeding]           = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  /* أرصدة الإجازات */
  const [employees, setEmployees]       = useState<Employee[]>([])
  const [selEmp, setSelEmp]             = useState('')
  const [balances, setBalances]         = useState<LeaveBalance[]>([])
  const [balYear, setBalYear]           = useState(thisYear)
  const [editing, setEditing]           = useState<Record<string, string>>({})
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoResult, setAutoResult]     = useState<{message: string; note?: string} | null>(null)

  /* طلبات الإجازة */
  const [requests, setRequests]         = useState<LeaveRequest[]>([])
  const [statusFilter, setStatusFilter] = useState('')

  const formRef = useRef<HTMLDivElement>(null)

  /* ── جلب البيانات ── */
  const loadTypes    = () => api.get('/leaves/types').then(r => setTypes(r.data)).catch(() => {})
  const loadRequests = () =>
    api.get(`/leaves/requests${statusFilter ? `?status=${statusFilter}` : ''}`).then(r => setRequests(r.data)).catch(() => {})

  const loadBalances = (empId: string) => {
    if (!empId) return setBalances([])
    api.get(`/leaves/balances/${empId}`).then(r => {
      const forYear: LeaveBalance[] = r.data.filter((b: LeaveBalance) => b.year === balYear)
      setBalances(forYear)
      const init: Record<string, string> = {}
      forYear.forEach(b => {
        const lt = types.find(t => t.name === b.leaveType.name)
        if (lt) init[lt.id] = String(b.entitledDays)
      })
      setEditing(init)
    }).catch(() => {})
  }

  useEffect(() => { loadTypes() }, [])
  useEffect(() => { loadRequests() }, [statusFilter])
  useEffect(() => {
    api.get('/employees?limit=500').then(r => setEmployees(r.data.data ?? r.data)).catch(() => {})
  }, [])
  useEffect(() => { loadBalances(selEmp) }, [selEmp, balYear, types.length])

  /* ── نموذج الإضافة / التعديل ── */
  const openAdd = () => {
    setEditId(null); setForm({ ...EMPTY_FORM }); setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const openEdit = (t: LeaveType) => {
    setEditId(t.id)
    setForm({
      name: t.name, description: t.description ?? '',
      maxDays: String(t.maxDays),
      maxDaysHalfPay: t.maxDaysHalfPay ? String(t.maxDaysHalfPay) : '',
      maxDaysUnpaid:  t.maxDaysUnpaid  ? String(t.maxDaysUnpaid)  : '',
      requiresApproval: t.requiresApproval, color: t.color ?? '#3B82F6',
      calculationType: t.calculationType,
      minDays: t.minDays ? String(t.minDays) : '',
      seniorityThreshold: t.seniorityThreshold ? String(t.seniorityThreshold) : '5',
    })
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const cancelForm = () => { setShowForm(false); setEditId(null); setForm({ ...EMPTY_FORM }) }

  const submitForm = async () => {
    if (!form.name.trim() || !form.maxDays) return
    setSaving(true)
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description || undefined,
        maxDays: Number(form.maxDays),
        maxDaysHalfPay: form.maxDaysHalfPay ? Number(form.maxDaysHalfPay) : undefined,
        maxDaysUnpaid:  form.maxDaysUnpaid  ? Number(form.maxDaysUnpaid)  : undefined,
        requiresApproval: form.requiresApproval,
        color: form.color,
        calculationType: form.calculationType,
      }
      if (form.calculationType === 'SENIORITY_BASED') {
        payload.minDays           = form.minDays ? Number(form.minDays) : undefined
        payload.seniorityThreshold = form.seniorityThreshold ? Number(form.seniorityThreshold) : 5
      }
      if (editId) {
        await api.put(`/leaves/types/${editId}`, payload)
      } else {
        await api.post('/leaves/types', payload)
      }
      cancelForm(); loadTypes()
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'خطأ في الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/leaves/types/${id}`)
      setDeleteConfirm(null); loadTypes()
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'خطأ في الحذف'); setDeleteConfirm(null)
    }
  }

  const seedSaudi = async () => {
    setSeeding(true)
    try {
      const res = await api.post('/leaves/types/seed-saudi-defaults')
      alert(res.data.message); loadTypes()
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'خطأ')
    } finally {
      setSeeding(false)
    }
  }

  /* ── التوزيع التلقائي ── */
  const runAutoAssign = async () => {
    setAutoAssigning(true); setAutoResult(null)
    try {
      const res = await api.post('/leaves/balances/auto-assign', {
        year: balYear,
        employeeId: selEmp || undefined,
      })
      setAutoResult({ message: res.data.message, note: res.data.note })
      loadBalances(selEmp)
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'خطأ في التوزيع التلقائي')
    } finally {
      setAutoAssigning(false)
    }
  }

  /* ── أرصدة ── */
  const saveBalance = async (typeId: string) => {
    const days = Number(editing[typeId] ?? 0)
    if (!selEmp || isNaN(days) || days < 0) return
    await api.post('/leaves/balances', {
      employeeId: selEmp, leaveTypeId: typeId, year: balYear, entitledDays: days,
    }).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
  }

  const saveAllBalances = async () => {
    if (!selEmp) return
    for (const lt of types) {
      const val = editing[lt.id]
      if (val !== undefined)
        await api.post('/leaves/balances', {
          employeeId: selEmp, leaveTypeId: lt.id, year: balYear, entitledDays: Number(val),
        }).catch(() => {})
    }
    loadBalances(selEmp); alert('تم حفظ الأرصدة ✅')
  }

  /* ── طلبات ── */
  const approve = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await api.put(`/leaves/requests/${id}/approve`, { status }).catch(e => alert(e.response?.data?.message))
    loadRequests()
  }

  const daysBetween = (s: string, e: string) =>
    Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1

  const balanceRows = types.map(lt => {
    const found     = balances.find(b => b.leaveType.name === lt.name)
    const entitled  = found?.entitledDays ?? 0
    const used      = found?.usedDays ?? 0
    return { id: lt.id, name: lt.name, maxDays: lt.maxDays, color: lt.color,
             calcType: lt.calculationType, entitledDays: entitled, usedDays: used, remaining: entitled - used }
  })

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">إدارة الإجازات</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {([
          { id: 'types',    label: 'أنواع الإجازات',  icon: '📋' },
          { id: 'balances', label: 'أرصدة الإجازات',  icon: '⚖️' },
          { id: 'requests', label: 'طلبات الإجازة',   icon: '📝' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1.5 ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ أنواع الإجازات ══════════ */}
      {tab === 'types' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={openAdd}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1.5">
              + إضافة نوع
            </button>
            <button onClick={seedSaudi} disabled={seeding}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-60 flex items-center gap-1.5">
              {seeding ? '⏳ جارٍ...' : '🇸🇦 أضف أنواع نظام العمل السعودي'}
            </button>
          </div>

          {/* جدول الأنواع */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['', 'نوع الإجازة', 'الاحتساب', 'الأيام', 'الوصف / المادة', 'اعتماد', ''].map((h, i) =>
                    <th key={i} className="text-right px-3 py-3 font-medium text-gray-600">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {types.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      <p className="text-3xl mb-2">🌴</p>
                      <p className="mb-3">لا توجد أنواع إجازات</p>
                      <button onClick={seedSaudi} disabled={seeding}
                        className="text-green-600 text-sm font-medium hover:underline">
                        انقر هنا لإضافة أنواع نظام العمل السعودي تلقائياً
                      </button>
                    </td>
                  </tr>
                ) : types.map(t => {
                  const ci = CALC_INFO[t.calculationType] ?? CALC_INFO.FIXED
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 group">
                      {/* لون */}
                      <td className="px-3 py-3 w-8">
                        <span className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                          style={{ backgroundColor: t.color ?? '#94a3b8' }} />
                      </td>
                      {/* الاسم */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">{t.name}</span>
                          {t.isSystemDefault && (
                            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">نظام العمل</span>
                          )}
                        </div>
                      </td>
                      {/* طريقة الاحتساب */}
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ci.badge}`}>
                          {ci.label}
                        </span>
                        <p className="text-gray-400 text-xs mt-0.5">{ci.desc}</p>
                      </td>
                      {/* الأيام */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {t.calculationType === 'SENIORITY_BASED' ? (
                          <div className="text-xs space-y-0.5">
                            <p><span className="text-gray-400">أقل من {t.seniorityThreshold ?? 5}س:</span> <b>{t.minDays ?? '—'}</b> يوم</p>
                            <p><span className="text-gray-400">فأكثر:</span> <b>{t.maxDays}</b> يوم</p>
                          </div>
                        ) : t.calculationType === 'SICK_TIERED' ? (
                          <div className="text-xs space-y-0.5">
                            <p><span className="text-green-600 font-medium">{t.maxDays}</span> كامل</p>
                            {t.maxDaysHalfPay && <p><span className="text-yellow-600 font-medium">{t.maxDaysHalfPay}</span> نصف</p>}
                            {t.maxDaysUnpaid  && <p><span className="text-red-500 font-medium">{t.maxDaysUnpaid}</span> بدون</p>}
                          </div>
                        ) : (
                          <span className="font-semibold">{t.maxDays} يوم</span>
                        )}
                      </td>
                      {/* الوصف */}
                      <td className="px-3 py-3 max-w-xs">
                        {t.description
                          ? <p className="text-xs text-gray-500 leading-relaxed line-clamp-2" title={t.description}>{t.description}</p>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      {/* اعتماد */}
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${t.requiresApproval ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                          {t.requiresApproval ? 'نعم' : 'لا'}
                        </span>
                      </td>
                      {/* أزرار */}
                      <td className="px-3 py-3 w-28">
                        {deleteConfirm === t.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">تأكيد؟</span>
                            <button onClick={() => handleDelete(t.id)}
                              className="bg-red-600 text-white text-xs px-2 py-0.5 rounded hover:bg-red-700">نعم</button>
                            <button onClick={() => setDeleteConfirm(null)}
                              className="bg-gray-100 text-xs px-2 py-0.5 rounded hover:bg-gray-200">لا</button>
                          </div>
                        ) : (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => openEdit(t)}
                              className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded border border-blue-200 hover:border-blue-400 transition">
                              تعديل
                            </button>
                            <button onClick={() => setDeleteConfirm(t.id)}
                              className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-200 hover:border-red-400 transition">
                              حذف
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── نموذج الإضافة / التعديل ── */}
          {showForm && (
            <div ref={formRef} className="bg-white rounded-xl shadow-sm border-2 border-blue-100 p-5">
              <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {editId ? '✎' : '+'}
                </span>
                {editId ? 'تعديل نوع الإجازة' : 'إضافة نوع إجازة جديد'}
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* الاسم */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">اسم الإجازة *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="إجازة سنوية" className={inp} />
                </div>

                {/* طريقة الاحتساب */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">طريقة الاحتساب التلقائي</label>
                  <select value={form.calculationType}
                    onChange={e => setForm({...form, calculationType: e.target.value as CalcType})}
                    className={inp}>
                    <option value="FIXED">ثابت للجميع</option>
                    <option value="SENIORITY_BASED">حسب سنوات الخدمة (الإجازة السنوية)</option>
                    <option value="SICK_TIERED">متدرّج — كامل / نصف / بدون (المرضية)</option>
                    <option value="ONCE_PER_EMPLOYMENT">مرة واحدة طوال الخدمة (الحج)</option>
                    <option value="PER_EVENT">عند وقوع الحدث (لا تُحتسب تلقائياً)</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">{CALC_INFO[form.calculationType]?.desc}</p>
                </div>

                {/* حقول Seniority */}
                {form.calculationType === 'SENIORITY_BASED' && (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">أيام قبل بلوغ العتبة (أقل أقدمية)</label>
                      <input type="number" value={form.minDays} min="1"
                        onChange={e => setForm({...form, minDays: e.target.value})} className={inp} placeholder="21" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">عتبة الأقدمية (سنوات)</label>
                      <input type="number" value={form.seniorityThreshold} min="1"
                        onChange={e => setForm({...form, seniorityThreshold: e.target.value})} className={inp} placeholder="5" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">أيام بعد العتبة (أعلى أقدمية) *</label>
                      <input type="number" value={form.maxDays} min="1"
                        onChange={e => setForm({...form, maxDays: e.target.value})} className={inp} placeholder="30" />
                    </div>
                  </>
                )}

                {/* حقول Sick Tiered */}
                {form.calculationType === 'SICK_TIERED' && (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">أيام براتب كامل *</label>
                      <input type="number" value={form.maxDays} min="1"
                        onChange={e => setForm({...form, maxDays: e.target.value})} className={`${inp} border-green-300 focus:ring-green-400`} placeholder="30" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">أيام بنصف الراتب</label>
                      <input type="number" value={form.maxDaysHalfPay} min="0"
                        onChange={e => setForm({...form, maxDaysHalfPay: e.target.value})} className={`${inp} border-yellow-300 focus:ring-yellow-400`} placeholder="60" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">أيام بدون راتب</label>
                      <input type="number" value={form.maxDaysUnpaid} min="0"
                        onChange={e => setForm({...form, maxDaysUnpaid: e.target.value})} className={`${inp} border-red-300 focus:ring-red-400`} placeholder="30" />
                    </div>
                  </>
                )}

                {/* الأيام لبقية الأنواع */}
                {!['SENIORITY_BASED','SICK_TIERED'].includes(form.calculationType) && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">عدد الأيام *</label>
                    <input type="number" value={form.maxDays} min="1"
                      onChange={e => setForm({...form, maxDays: e.target.value})} className={inp} />
                  </div>
                )}

                {/* يحتاج اعتماد */}
                <div className="flex items-center gap-3 pt-5">
                  <input type="checkbox" id="reqApproval" checked={form.requiresApproval}
                    onChange={e => setForm({...form, requiresApproval: e.target.checked})}
                    className="w-4 h-4 rounded accent-blue-600" />
                  <label htmlFor="reqApproval" className="text-sm text-gray-700">تحتاج إلى اعتماد</label>
                </div>

                {/* اللون */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">اللون</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.color}
                      onChange={e => setForm({...form, color: e.target.value})}
                      className="w-9 h-9 rounded border cursor-pointer p-0.5" />
                    <div className="flex gap-1 flex-wrap">
                      {COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setForm({...form, color: c})}
                          className={`w-5 h-5 rounded-full border-2 transition ${form.color === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* الوصف */}
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">الوصف / المرجع القانوني</label>
                  <textarea value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                    rows={2} placeholder="المادة 109 من نظام العمل السعودي..."
                    className={`${inp} resize-none`} />
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={submitForm} disabled={saving || !form.name || !form.maxDays}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition">
                  {saving ? 'جارٍ الحفظ...' : editId ? '💾 حفظ التعديلات' : '+ إضافة'}
                </button>
                <button onClick={cancelForm}
                  className="px-5 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50">إلغاء</button>
              </div>
            </div>
          )}

          {/* ملاحظة نظام العمل */}
          {types.some(t => t.isSystemDefault) && (
            <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p className="font-semibold mb-2">📖 ملاحظات نظام العمل السعودي</p>
              <p>• <b>SENIORITY_BASED</b>: يحتسب النظام تلقائياً 21 يوم (خدمة &lt; 5 سنوات) أو 30 يوم (5 سنوات فأكثر)</p>
              <p>• <b>ONCE_PER_EMPLOYMENT</b>: يتحقق النظام من سجلات الاستخدام ويمنح 0 إن سبق استخدامها</p>
              <p>• <b>PER_EVENT</b>: لا تُضاف تلقائياً — تُمنح يدوياً عند الحاجة (ولادة، زواج، وفاة)</p>
              <p>• <b>SICK_TIERED</b>: يُضاف رصيد الراتب الكامل (30 يوم) — الأيام المتبقية تُدار حسب الفئة</p>
            </div>
          )}
        </>
      )}

      {/* ══════════ أرصدة الإجازات ══════════ */}
      {tab === 'balances' && (
        <>
          <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
            <div className="flex gap-4 flex-wrap items-end">
              <div className="flex-1 min-w-52">
                <label className="text-xs text-gray-500 mb-1 block">الموظف</label>
                <select value={selEmp} onChange={e => setSelEmp(e.target.value)} className={inp}>
                  <option value="">-- كل الموظفين --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
                </select>
              </div>
              <div className="w-28">
                <label className="text-xs text-gray-500 mb-1 block">السنة</label>
                <input type="number" value={balYear} min={2020} max={2035}
                  onChange={e => setBalYear(Number(e.target.value))} className={inp} />
              </div>
              <div className="flex gap-2">
                {/* توزيع تلقائي */}
                <button onClick={runAutoAssign} disabled={autoAssigning}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-60 flex items-center gap-1.5">
                  {autoAssigning ? '⏳ جارٍ...' : '⚡ توزيع تلقائي'}
                </button>
                {/* حفظ الكل */}
                {selEmp && types.length > 0 && (
                  <button onClick={saveAllBalances}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                    💾 حفظ الكل
                  </button>
                )}
              </div>
            </div>

            {/* شرح التوزيع التلقائي */}
            <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border">
              <span className="font-medium text-purple-700">⚡ التوزيع التلقائي</span> يحتسب الأيام المستحقة لكل موظف حسب قواعد نظام العمل:
              <span className="text-purple-600"> الإجازة السنوية</span> حسب سنوات خدمته،
              <span className="text-orange-600"> المرضية</span> براتب كامل (30 يوم)،
              <span className="text-yellow-600"> الحج</span> مرة واحدة فقط طوال الخدمة.
              {selEmp ? ` سيُطبَّق على موظف واحد.` : ` سيُطبَّق على جميع الموظفين النشطين.`}
            </div>
          </div>

          {/* نتيجة التوزيع التلقائي */}
          {autoResult && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
              <p className="text-green-700 font-medium">✅ {autoResult.message}</p>
              {autoResult.note && <p className="text-yellow-600 mt-1 text-xs">⚠️ {autoResult.note}</p>}
            </div>
          )}

          {/* جدول الأرصدة */}
          {!selEmp ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b">
                <span className="text-sm text-gray-500">جميع الموظفين — سنة {balYear}</span>
                <span className="text-xs text-gray-400 mr-2">(اختر موظفاً لعرض أرصدته أو اضغط «توزيع تلقائي» لتوزيع الكل)</span>
              </div>
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <span className="text-3xl">🌴</span>
                <p className="text-sm">اختر موظفاً أو اضغط «توزيع تلقائي» لتوزيع الأرصدة على الجميع</p>
              </div>
            </div>
          ) : types.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
              أضف أنواع الإجازات من تبويب <strong>«أنواع الإجازات»</strong> أولاً
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-blue-50 border-b flex items-center justify-between">
                <div className="font-semibold text-blue-800">
                  {employees.find(e => e.id === selEmp)?.fullName}
                  <span className="font-normal text-blue-500 text-xs mr-2">— سنة {balYear}</span>
                </div>
                <span className="text-xs text-blue-400">عدّل الأيام المستحقة ثم اضغط حفظ</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['', 'نوع الإجازة', 'طريقة الاحتساب', 'الأيام المستحقة', 'المستخدم', 'المتبقي', ''].map((h, i) =>
                      <th key={i} className="text-right px-3 py-3 font-medium text-gray-600">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {balanceRows.map(row => {
                    const ci = CALC_INFO[row.calcType as CalcType] ?? CALC_INFO.FIXED
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <span className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: row.color ?? '#94a3b8' }} />
                        </td>
                        <td className="px-3 py-3 font-medium">{row.name}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ci.badge}`}>{ci.label}</span>
                        </td>
                        <td className="px-3 py-3">
                          <input type="number" min="0"
                            value={editing[row.id] ?? String(row.entitledDays)}
                            onChange={e => setEditing(prev => ({ ...prev, [row.id]: e.target.value }))}
                            className="border rounded-lg px-3 py-1.5 text-sm w-24 text-center focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </td>
                        <td className="px-3 py-3 text-center font-medium text-red-500">{row.usedDays}</td>
                        <td className="px-3 py-3 text-center font-bold">
                          <span className={row.remaining > 0 ? 'text-green-600' : row.remaining < 0 ? 'text-red-600' : 'text-gray-400'}>
                            {row.remaining}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <button onClick={() => saveBalance(row.id)}
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded text-xs font-medium transition">
                            حفظ
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t bg-gray-50 font-semibold text-sm">
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-gray-700">الإجمالي</td>
                    <td className="px-3 py-3 text-center text-blue-700">
                      {balanceRows.reduce((s, r) => s + (Number(editing[r.id] ?? r.entitledDays) || 0), 0)}
                    </td>
                    <td className="px-3 py-3 text-center text-red-500">
                      {balanceRows.reduce((s, r) => s + r.usedDays, 0)}
                    </td>
                    <td className="px-3 py-3 text-center text-green-600">
                      {balanceRows.reduce((s, r) => s + r.remaining, 0)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══════════ طلبات الإجازة ══════════ */}
      {tab === 'requests' && (
        <>
          <div className="flex gap-3 mb-4">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inp} w-40`}>
              <option value="">كل الحالات</option>
              <option value="PENDING">معلق</option>
              <option value="APPROVED">مقبول</option>
              <option value="REJECTED">مرفوض</option>
            </select>
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['الموظف', 'نوع الإجازة', 'من', 'إلى', 'الأيام', 'الحالة', 'إجراء'].map(h =>
                    <th key={h} className="text-right px-4 py-3 font-medium text-gray-600">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.length === 0
                  ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">لا توجد طلبات</td></tr>
                  : requests.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.employee.fullName}</p>
                      <p className="text-gray-400 text-xs">{r.employee.employeeCode}</p>
                    </td>
                    <td className="px-4 py-3">{r.leaveType.name}</td>
                    <td className="px-4 py-3">{new Date(r.startDate).toLocaleDateString('ar-SA')}</td>
                    <td className="px-4 py-3">{new Date(r.endDate).toLocaleDateString('ar-SA')}</td>
                    <td className="px-4 py-3 text-center font-bold">{daysBetween(r.startDate, r.endDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS[r.status]?.color}`}>
                        {STATUS[r.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'PENDING' && (
                        <div className="flex gap-1">
                          <button onClick={() => approve(r.id, 'APPROVED')}
                            className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-100">قبول</button>
                          <button onClick={() => approve(r.id, 'REJECTED')}
                            className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-100">رفض</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
