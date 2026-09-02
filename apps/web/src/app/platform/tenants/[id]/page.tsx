'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { platformApi } from '../../../../lib/platform-api'

type EmployeeStatus = 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
interface TenantDetails {
  id: string; name: string; logo: string | null; planStatus: string; maxUsers: number | null
  employeeCounts: { active: number; suspended: number; terminated: number; loginEnabled: number }
  _count: { employees: number; branches: number }
}
interface Employee {
  id: string; employeeCode: string; fullName: string; email: string | null; phone: string | null
  status: EmployeeStatus
  branch: { id: string; name: string }
  department: { id: string; name: string } | null
  jobTitle: { id: string; name: string } | null
  employeeRoles: Array<{ role: { name: string } }>
}

const statusMeta: Record<EmployeeStatus, { label: string; color: string; soft: string }> = {
  ACTIVE: { label: 'نشط', color: 'var(--good)', soft: 'var(--good-soft)' },
  SUSPENDED: { label: 'موقوف', color: 'var(--warn)', soft: 'var(--warn-soft)' },
  TERMINATED: { label: 'منتهي', color: 'var(--crit)', soft: 'var(--crit-soft)' },
}
const inputClass = 'w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2'
const inputStyle = { background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }

export default function TenantOperationsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tenant, setTenant] = useState<TenantDetails | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [statusFilter, setStatusFilter] = useState<'ALL' | EmployeeStatus>('ALL')
  const [selected, setSelected] = useState<Employee | null>(null)
  const [edit, setEdit] = useState({ fullName: '', email: '', phone: '', status: 'ACTIVE' as EmployeeStatus })
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const load = async (query = '') => {
    const token = localStorage.getItem('platform_access_token')
    if (!token) { router.replace('/platform/login'); return }
    setLoading(true)
    try {
      const [tenantRes, employeesRes] = await Promise.all([
        platformApi.get(`/platform/tenants/${id}`),
        platformApi.get(`/platform/tenants/${id}/employees`, { params: query ? { search: query } : undefined }),
      ])
      setTenant(tenantRes.data)
      setEmployees(employeesRes.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load(deferredSearch) }, [id, deferredSearch])

  const openEmployee = (employee: Employee) => {
    setSelected(employee)
    setEdit({ fullName: employee.fullName, email: employee.email ?? '', phone: employee.phone ?? '', status: employee.status })
    setNewPassword('')
    setNotice('')
  }

  const saveEmployee = async () => {
    if (!selected || !edit.fullName.trim() || !edit.email.trim()) return
    setSaving(true); setNotice('')
    try {
      await platformApi.put(`/platform/tenants/${id}/employees/${selected.id}`, edit)
      setNotice('تم حفظ بيانات الموظف')
      await load(deferredSearch)
      setSelected(prev => prev ? { ...prev, ...edit } : prev)
    } catch (e: any) { setNotice(e.response?.data?.message ?? 'تعذر حفظ البيانات') }
    finally { setSaving(false) }
  }

  const resetPassword = async () => {
    if (!selected || newPassword.length < 12) { setNotice('كلمة المرور يجب أن تكون 12 حرفًا على الأقل'); return }
    if (!confirm(`ضبط كلمة مرور جديدة للموظف «${selected.fullName}»؟`)) return
    setSaving(true); setNotice('')
    try {
      await platformApi.put(`/platform/tenants/${id}/employees/${selected.id}/password`, { password: newPassword })
      setNewPassword(''); setNotice('تم ضبط كلمة المرور الجديدة')
    } catch (e: any) { setNotice(e.response?.data?.message ?? 'تعذر ضبط كلمة المرور') }
    finally { setSaving(false) }
  }

  const filtered = statusFilter === 'ALL' ? employees : employees.filter(e => e.status === statusFilter)
  if (loading && !tenant) return <div className="min-h-screen grid place-items-center" style={{ color: 'var(--ink-3)' }}>جارٍ تحميل بيانات الشركة…</div>
  if (!tenant) return <div className="p-8 text-center" style={{ color: 'var(--crit)' }}>تعذر تحميل الشركة</div>

  const cards = [
    ['كل الموظفين', tenant._count.employees, 'var(--ink)', 'var(--surface)'],
    ['نشط', tenant.employeeCounts.active, 'var(--good)', 'var(--good-soft)'],
    ['موقوف', tenant.employeeCounts.suspended, 'var(--warn)', 'var(--warn-soft)'],
    ['منتهي', tenant.employeeCounts.terminated, 'var(--crit)', 'var(--crit-soft)'],
    ['حسابات دخول', tenant.employeeCounts.loginEnabled, 'var(--brand)', 'var(--brand-soft)'],
  ] as const

  return (
    <main className="min-h-screen p-4 md:p-7" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
          <div>
            <button onClick={() => router.push('/platform/tenants')} className="text-xs mb-3" style={{ color: 'var(--brand)' }}>← العودة إلى الشركات</button>
            <p className="text-xs font-bold tracking-wide" style={{ color: 'var(--accent)' }}>مركز عمليات الشركة</p>
            <h1 className="text-3xl font-black mt-1" style={{ color: 'var(--ink)' }}>{tenant.name}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>{tenant._count.branches} فروع · إدارة حسابات الموظفين واستعادتها من مكان واحد</p>
          </div>
          <span className="self-start text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>مالك المنصة فقط</span>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6" aria-label="إحصاءات الموظفين">
          {cards.map(([label, value, color, background]) => (
            <div key={label} className="rounded-2xl p-4" style={{ background, border: '1px solid var(--line)' }}>
              <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{label}</p>
              <p className="text-3xl font-black mt-2 tabular-nums" style={{ color }}>{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
          <div className="p-4 border-b flex flex-col md:flex-row gap-3 md:items-center" style={{ borderColor: 'var(--line)' }}>
            <div className="flex-1">
              <label htmlFor="employee-search" className="sr-only">البحث عن موظف</label>
              <input id="employee-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم الوظيفي أو البريد أو الجوال…" className={inputClass} style={inputStyle} />
            </div>
            <div className="flex gap-1 overflow-x-auto" role="group" aria-label="تصفية حسب الحالة">
              {([['ALL', 'الكل'], ['ACTIVE', 'نشط'], ['SUSPENDED', 'موقوف'], ['TERMINATED', 'منتهي']] as const).map(([value, label]) => (
                <button key={value} onClick={() => setStatusFilter(value)} className="text-xs whitespace-nowrap px-3 py-2 rounded-lg font-semibold"
                  style={statusFilter === value ? { background: 'var(--ink)', color: 'var(--surface)' } : { background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{label}</button>
              ))}
            </div>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {filtered.length === 0 ? <div className="text-center py-14 text-sm" style={{ color: 'var(--ink-3)' }}>لا يوجد موظفون مطابقون للبحث</div> : filtered.map(employee => {
              const meta = statusMeta[employee.status]
              return (
                <button key={employee.id} onClick={() => openEmployee(employee)} className="w-full text-right p-4 grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1.4fr_1fr_1fr_auto] gap-3 items-center hover:bg-[var(--surface-2)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--brand)]">
                  <span className="w-10 h-10 rounded-xl grid place-items-center font-black" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>{employee.fullName.charAt(0)}</span>
                  <span className="min-w-0"><strong className="text-sm block truncate" style={{ color: 'var(--ink)' }}>{employee.fullName}</strong><small style={{ color: 'var(--ink-3)' }}>{employee.employeeCode}</small></span>
                  <span className="hidden md:block text-xs truncate" style={{ color: 'var(--ink-2)' }}>{employee.jobTitle?.name ?? 'بلا مسمى'} · {employee.department?.name ?? 'بلا قسم'}</span>
                  <span className="hidden md:block text-xs truncate" style={{ color: 'var(--ink-3)' }}>{employee.email ?? 'لا يوجد بريد'}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ color: meta.color, background: meta.soft }}>{meta.label}</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-5" style={{ background: 'rgba(8,18,15,.55)' }} onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="w-full md:max-w-xl rounded-t-3xl md:rounded-3xl p-5 md:p-6 max-h-[92vh] overflow-y-auto" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-lift)' }} role="dialog" aria-modal="true" aria-labelledby="employee-dialog-title">
            <div className="flex justify-between items-start mb-5">
              <div><p className="text-xs" style={{ color: 'var(--ink-3)' }}>{selected.employeeCode}</p><h2 id="employee-dialog-title" className="text-xl font-black" style={{ color: 'var(--ink)' }}>{selected.fullName}</h2></div>
              <button onClick={() => setSelected(null)} className="w-9 h-9 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }} aria-label="إغلاق">✕</button>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-xs" style={{ color: 'var(--ink-2)' }}>الاسم الكامل<input value={edit.fullName} onChange={e => setEdit(v => ({ ...v, fullName: e.target.value }))} className={`${inputClass} mt-1`} style={inputStyle} /></label>
              <label className="text-xs" style={{ color: 'var(--ink-2)' }}>البريد الإلكتروني<input type="email" value={edit.email} onChange={e => setEdit(v => ({ ...v, email: e.target.value }))} className={`${inputClass} mt-1`} style={inputStyle} /></label>
              <label className="text-xs" style={{ color: 'var(--ink-2)' }}>رقم الجوال<input value={edit.phone} onChange={e => setEdit(v => ({ ...v, phone: e.target.value }))} className={`${inputClass} mt-1`} style={inputStyle} /></label>
              <label className="text-xs" style={{ color: 'var(--ink-2)' }}>حالة الموظف<select value={edit.status} onChange={e => setEdit(v => ({ ...v, status: e.target.value as EmployeeStatus }))} className={`${inputClass} mt-1`} style={inputStyle}><option value="ACTIVE">نشط / استعادة</option><option value="SUSPENDED">موقوف مؤقتًا</option><option value="TERMINATED">منتهي</option></select></label>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--ink-3)' }}>الفرع: {selected.branch.name} · القسم: {selected.department?.name ?? 'غير محدد'} · الأدوار: {selected.employeeRoles.map(r => r.role.name).join('، ') || 'بلا دور'}</p>
            <button onClick={saveEmployee} disabled={saving} className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: 'var(--brand)' }}>{saving ? 'جارٍ الحفظ…' : 'حفظ بيانات الموظف'}</button>

            <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--line)' }}>
              <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>إعادة ضبط الدخول</h3>
              <p className="text-xs mt-1 mb-3" style={{ color: 'var(--ink-3)' }}>لن تظهر كلمة المرور القديمة، وسيبدأ الموظف باستخدام الجديدة فورًا.</p>
              <div className="flex gap-2">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="كلمة مرور جديدة — 12 حرفًا على الأقل" className={inputClass} style={inputStyle} />
                <button onClick={resetPassword} disabled={saving} className="shrink-0 px-4 rounded-xl text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>ضبط</button>
              </div>
            </div>
            {notice ? <p className="text-xs mt-4 p-3 rounded-xl" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{notice}</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}
