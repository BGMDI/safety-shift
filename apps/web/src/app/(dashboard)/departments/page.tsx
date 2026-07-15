'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

/* ══════════════════════════════════════════
   أنواع البيانات
══════════════════════════════════════════ */
interface Dept     { id: string; name: string; _count: { employees: number } }
interface Branch   { id: string; name: string; location: string | null; _count: { employees: number }; departments: Dept[] }
interface FreeDept { id: string; name: string; branch: { id: string; name: string } | null; _count: { employees: number; children: number } }
interface JobTitle { id: string; name: string; grade: string | null; baseSalary: number; _count: { employees: number } }

const inp = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full bg-white'

/* ══════════════════════════════════════════
   الصفحة الرئيسية
══════════════════════════════════════════ */
export default function OrgPage() {
  useAuth()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const tab          = (searchParams.get('tab') ?? 'org') as 'org' | 'jobs'

  const setTab = (t: 'org' | 'jobs') => router.replace(`/departments?tab=${t}`)

  return (
    <div className="p-6 max-w-4xl">

      {/* ── Header ── */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">الهيكل التنظيمي</h1>
        <p className="text-gray-500 text-sm mt-0.5">إدارة الفروع والأقسام والمسميات الوظيفية</p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {[
          { key: 'org',  label: '🏢 الفروع والأقسام' },
          { key: 'jobs', label: '📋 المسميات الوظيفية' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'org' | 'jobs')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── محتوى التبويب ── */}
      {tab === 'org'  && <OrgTab />}
      {tab === 'jobs' && <JobsTab />}
    </div>
  )
}

/* ══════════════════════════════════════════
   تبويب الفروع والأقسام
══════════════════════════════════════════ */
function OrgTab() {
  const [branches, setBranches]   = useState<Branch[]>([])
  const [freeDepts, setFreeDepts] = useState<FreeDept[]>([])

  const [showAddBranch, setShowAddBranch]   = useState(false)
  const [branchForm, setBranchForm]         = useState({ name: '', location: '' })
  const [savingBranch, setSavingBranch]     = useState(false)
  const [editBranchId, setEditBranchId]     = useState<string | null>(null)
  const [editBranchData, setEditBranchData] = useState({ name: '', location: '' })

  const [addingDept, setAddingDept] = useState<Record<string, boolean>>({})
  const [deptInput, setDeptInput]   = useState<Record<string, string>>({})
  const [savingDept, setSavingDept] = useState<Record<string, boolean>>({})
  const [editDeptId, setEditDeptId]     = useState<string | null>(null)
  const [editDeptName, setEditDeptName] = useState('')

  const [showAddFree, setShowAddFree] = useState(false)
  const [freeName, setFreeName]       = useState('')
  const [savingFree, setSavingFree]   = useState(false)

  const load = async () => {
    const [brRes, deptRes] = await Promise.all([
      api.get('/branches').catch(() => ({ data: [] })),
      api.get('/departments').catch(() => ({ data: [] })),
    ])
    setBranches(brRes.data)
    setFreeDepts((deptRes.data as FreeDept[]).filter(d => !d.branch))
  }
  useEffect(() => { load() }, [])

  /* ── فروع ── */
  const createBranch = async () => {
    if (!branchForm.name.trim()) return
    setSavingBranch(true)
    await api.post('/branches', branchForm).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    setBranchForm({ name: '', location: '' }); setShowAddBranch(false); setSavingBranch(false); load()
  }
  const updateBranch = async (id: string) => {
    await api.put(`/branches/${id}`, editBranchData).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    setEditBranchId(null); load()
  }
  const deleteBranch = async (b: Branch) => {
    if (b._count.employees > 0) { alert(`لا يمكن حذف الفرع — يوجد ${b._count.employees} موظف`); return }
    if (!confirm(`حذف فرع "${b.name}"؟`)) return
    await api.delete(`/branches/${b.id}`).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  /* ── أقسام ── */
  const createDept = async (branchId: string) => {
    const name = deptInput[branchId]?.trim(); if (!name) return
    setSavingDept(p => ({ ...p, [branchId]: true }))
    await api.post('/departments', { name, branchId }).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    setDeptInput(p => ({ ...p, [branchId]: '' })); setAddingDept(p => ({ ...p, [branchId]: false }))
    setSavingDept(p => ({ ...p, [branchId]: false })); load()
  }
  const createFreeDept = async () => {
    if (!freeName.trim()) return; setSavingFree(true)
    await api.post('/departments', { name: freeName }).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    setFreeName(''); setShowAddFree(false); setSavingFree(false); load()
  }
  const updateDept = async (id: string) => {
    if (!editDeptName.trim()) return
    await api.put(`/departments/${id}`, { name: editDeptName }).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    setEditDeptId(null); load()
  }
  const deleteDept = async (id: string, name: string, empCount: number) => {
    if (empCount > 0) { alert('لا يمكن حذف قسم يحتوي على موظفين'); return }
    if (!confirm(`حذف قسم "${name}"؟`)) return
    await api.delete(`/departments/${id}`).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  /* ── مكوّن قسم ── */
  const DeptChip = ({ d }: { d: Dept | FreeDept }) => {
    const empCount = d._count.employees
    if (editDeptId === d.id) return (
      <div className="flex items-center gap-2 bg-white border-2 border-blue-300 rounded-lg px-3 py-2">
        <input value={editDeptName} onChange={e => setEditDeptName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') updateDept(d.id); if (e.key === 'Escape') setEditDeptId(null) }}
          autoFocus className="flex-1 text-sm outline-none" />
        <button onClick={() => updateDept(d.id)} className="text-green-600 text-xs font-bold hover:text-green-700">✓</button>
        <button onClick={() => setEditDeptId(null)} className="text-gray-400 text-xs hover:text-gray-600">✕</button>
      </div>
    )
    return (
      <div className="group flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-blue-200 hover:shadow-sm transition-all">
        <span className="text-gray-400 text-sm">📂</span>
        <span className="text-sm text-gray-700 font-medium flex-1">{d.name}</span>
        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{empCount} موظف</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => { setEditDeptId(d.id); setEditDeptName(d.name) }}
            className="text-blue-400 hover:text-blue-600 text-xs px-1.5 py-0.5 rounded hover:bg-blue-50">✎</button>
          <button onClick={() => deleteDept(d.id, d.name, empCount)}
            className="text-red-300 hover:text-red-500 text-xs px-1.5 py-0.5 rounded hover:bg-red-50">✕</button>
        </div>
      </div>
    )
  }

  const totalEmps  = branches.reduce((s, b) => s + b._count.employees, 0)
  const totalDepts = branches.reduce((s, b) => s + b.departments.length, 0) + freeDepts.length

  return (
    <div className="space-y-4">

      {/* شريط الإحصاء + زر إضافة فرع */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {branches.length} فرع · {totalDepts} قسم · {totalEmps} موظف
        </p>
        <button onClick={() => setShowAddBranch(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl shadow-sm transition">
          {showAddBranch ? '✕ إلغاء' : '+ إضافة فرع'}
        </button>
      </div>

      {/* نموذج إضافة فرع */}
      {showAddBranch && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">فرع جديد</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">اسم الفرع *</label>
              <input value={branchForm.name} onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createBranch()}
                placeholder="المقر الرئيسي، فرع جدة..." autoFocus className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">المدينة / الموقع</label>
              <input value={branchForm.location} onChange={e => setBranchForm(p => ({ ...p, location: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createBranch()}
                placeholder="الرياض، جدة..." className={inp} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={createBranch} disabled={savingBranch || !branchForm.name.trim()}
              className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {savingBranch ? '⏳ جارٍ...' : '✓ حفظ الفرع'}
            </button>
            <button onClick={() => setShowAddBranch(false)}
              className="border text-gray-500 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">إلغاء</button>
          </div>
        </div>
      )}

      {/* قائمة الفروع */}
      {branches.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-14 text-gray-400">
          <p className="text-4xl mb-3">🏪</p>
          <p className="font-medium">لا توجد فروع بعد</p>
          <p className="text-sm mt-1">انقر "+ إضافة فرع" لإنشاء أول فرع</p>
        </div>
      ) : branches.map(b => (
        <div key={b.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

          {/* رأس الفرع */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-l from-blue-50/40 to-white">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">🏪</div>

            {editBranchId === b.id ? (
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <input value={editBranchData.name} onChange={e => setEditBranchData(p => ({ ...p, name: e.target.value }))}
                  className="border-2 border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none w-40 bg-white" autoFocus />
                <input value={editBranchData.location} onChange={e => setEditBranchData(p => ({ ...p, location: e.target.value }))}
                  placeholder="الموقع" className="border rounded-lg px-2 py-1.5 text-sm outline-none w-32 bg-white" />
                <button onClick={() => updateBranch(b.id)}
                  className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700">✓ حفظ</button>
                <button onClick={() => setEditBranchId(null)}
                  className="border text-gray-500 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-50">إلغاء</button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800">{b.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.location ? `📍 ${b.location} · ` : ''}
                    {b.departments.length} قسم
                    {b._count.employees > 0 ? ` · ${b._count.employees} موظف` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-lg font-medium">👥 {b._count.employees}</span>
                  <button onClick={() => { setEditBranchId(b.id); setEditBranchData({ name: b.name, location: b.location ?? '' }) }}
                    className="text-gray-400 hover:text-blue-600 text-xs px-2.5 py-1 rounded-lg hover:bg-blue-50 transition">✎ تعديل</button>
                  <button onClick={() => deleteBranch(b)}
                    className="text-gray-400 hover:text-red-500 text-xs px-2.5 py-1 rounded-lg hover:bg-red-50 transition">حذف</button>
                </div>
              </>
            )}
          </div>

          {/* أقسام الفرع */}
          <div className="px-5 py-4 border-t border-gray-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                الأقسام
                {b.departments.length > 0 && (
                  <span className="mr-2 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full normal-case">
                    {b.departments.length}
                  </span>
                )}
              </p>
              <button onClick={() => setAddingDept(p => ({ ...p, [b.id]: !p[b.id] }))}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition">
                {addingDept[b.id] ? '✕ إلغاء' : '+ إضافة قسم'}
              </button>
            </div>

            {addingDept[b.id] && (
              <div className="flex gap-2 mb-3">
                <input value={deptInput[b.id] ?? ''} onChange={e => setDeptInput(p => ({ ...p, [b.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && createDept(b.id)}
                  placeholder="اسم القسم الجديد..." autoFocus
                  className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                <button onClick={() => createDept(b.id)} disabled={savingDept[b.id] || !deptInput[b.id]?.trim()}
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                  {savingDept[b.id] ? '...' : 'إضافة'}
                </button>
              </div>
            )}

            {b.departments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">لا توجد أقسام — انقر "+ إضافة قسم"</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {b.departments.map(d => <DeptChip key={d.id} d={d} />)}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* أقسام عامة */}
      {freeDepts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-l from-gray-50/60 to-white border-b border-gray-50">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">🏢</div>
            <div className="flex-1">
              <p className="font-bold text-gray-700">أقسام عامة</p>
              <p className="text-xs text-gray-400 mt-0.5">غير مرتبطة بفرع محدد</p>
            </div>
            <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-lg">{freeDepts.length} قسم</span>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {freeDepts.map(d => <DeptChip key={d.id} d={d} />)}
            </div>
          </div>
        </div>
      )}

      {/* إضافة قسم عام */}
      <div className="bg-white rounded-xl border border-dashed border-gray-200 overflow-hidden">
        {showAddFree ? (
          <div className="px-5 py-4 flex gap-2">
            <input value={freeName} onChange={e => setFreeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createFreeDept(); if (e.key === 'Escape') setShowAddFree(false) }}
              placeholder="اسم القسم العام..." autoFocus
              className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 bg-white" />
            <button onClick={createFreeDept} disabled={savingFree || !freeName.trim()}
              className="bg-gray-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap">
              {savingFree ? '...' : 'إضافة'}
            </button>
            <button onClick={() => setShowAddFree(false)}
              className="border text-gray-400 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowAddFree(true)}
            className="w-full text-gray-400 hover:text-gray-700 text-sm py-4 flex items-center justify-center gap-2 hover:bg-gray-50 transition">
            + إضافة قسم عام (غير مرتبط بفرع)
          </button>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   تبويب المسميات الوظيفية
══════════════════════════════════════════ */
function JobsTab() {
  const [titles, setTitles]   = useState<JobTitle[]>([])
  const [form, setForm]       = useState({ name: '', grade: '', baseSalary: '' })
  const [saving, setSaving]   = useState(false)
  const [editId, setEditId]   = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', grade: '', baseSalary: '' })

  const load = () => api.get('/job-titles').then(r => setTitles(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await api.post('/job-titles', {
      name: form.name,
      grade: form.grade || undefined,
      baseSalary: Number(form.baseSalary) || 0,
    }).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    setForm({ name: '', grade: '', baseSalary: '' }); setSaving(false); load()
  }

  const update = async (id: string) => {
    await api.put(`/job-titles/${id}`, {
      name: editData.name,
      grade: editData.grade || undefined,
      baseSalary: Number(editData.baseSalary) || 0,
    }).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    setEditId(null); load()
  }

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return
    await api.delete(`/job-titles/${id}`).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  return (
    <div className="space-y-5">

      {/* نموذج إضافة وظيفة */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">إضافة مسمى وظيفي جديد</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">المسمى الوظيفي *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="مدير، محاسب، مهندس..." className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">الدرجة الوظيفية</label>
            <input value={form.grade} onChange={e => setForm(p => ({ ...p, grade: e.target.value }))}
              placeholder="أولى، ثانية، A1..." className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">الراتب الأساسي (ر.س)</label>
            <input value={form.baseSalary} onChange={e => setForm(p => ({ ...p, baseSalary: e.target.value }))}
              type="number" min="0" placeholder="0" className={inp} />
          </div>
        </div>
        <button onClick={create} disabled={saving || !form.name.trim()}
          className="mt-3 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? '⏳ جارٍ...' : '+ إضافة مسمى وظيفي'}
        </button>
      </div>

      {/* جدول الوظائف */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {titles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium">لا توجد مسميات وظيفية</p>
            <p className="text-sm mt-1">أضف أول مسمى وظيفي من النموذج أعلاه</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['المسمى الوظيفي', 'الدرجة', 'الراتب الأساسي', 'الموظفون', ''].map(h => (
                  <th key={h} className="text-right px-4 py-3 font-medium text-gray-600 text-sm">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {titles.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {editId === t.id
                      ? <input value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                          className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-36" autoFocus />
                      : t.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {editId === t.id
                      ? <input value={editData.grade} onChange={e => setEditData(p => ({ ...p, grade: e.target.value }))}
                          className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-24" />
                      : (t.grade
                          ? <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{t.grade}</span>
                          : <span className="text-gray-300">—</span>)}
                  </td>
                  <td className="px-4 py-3">
                    {editId === t.id
                      ? <input value={editData.baseSalary} type="number" min="0"
                          onChange={e => setEditData(p => ({ ...p, baseSalary: e.target.value }))}
                          className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-28" />
                      : <span className="font-mono text-gray-700">{Number(t.baseSalary).toLocaleString('ar-SA')} ر.س</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {t._count.employees}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {editId === t.id ? (
                        <>
                          <button onClick={() => update(t.id)}
                            className="text-green-600 text-xs px-3 py-1.5 rounded-lg hover:bg-green-50">✓ حفظ</button>
                          <button onClick={() => setEditId(null)}
                            className="text-gray-400 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-50">إلغاء</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(t.id); setEditData({ name: t.name, grade: t.grade ?? '', baseSalary: String(t.baseSalary) }) }}
                            className="text-blue-600 text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50">تعديل</button>
                          <button onClick={() => remove(t.id)}
                            className="text-red-500 text-xs px-3 py-1.5 rounded-lg hover:bg-red-50">حذف</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
