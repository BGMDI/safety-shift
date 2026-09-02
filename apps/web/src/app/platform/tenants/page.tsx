'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { platformApi } from '../../../lib/platform-api'

interface Template { id: string; name: string; modules: string[]; monthlyPrice: string | null; isActive: boolean }
interface LeaveReq {
  id: string; startDate: string; endDate: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; notes: string | null
  hiddenFromTenant: boolean
  employee: { fullName: string; employeeCode: string }
  leaveType: { name: string }
}
interface PlatformAudit {
  id: string; action: string; entityId: string | null; details: any; createdAt: string
}
const PLATFORM_ACTION_LABEL: Record<string, string> = {
  TENANT_IMPERSONATE: '🔑 دخول كإدارة الشركة',
  LEAVE_REQUEST_DELETE: '🗑 حذف طلب إجازة (من سجل الشركة فقط)',
  EMPLOYEE_UPDATE: '✎ تعديل بيانات موظف أو حالته',
  EMPLOYEE_PASSWORD_RESET: '🔐 إعادة ضبط كلمة مرور موظف',
  EMPLOYEES_EXCEL_IMPORT: '📥 استيراد موظفين من ملف Excel',
}
interface Tenant {
  id: string; name: string; logo: string | null; planStatus: string; plan: string
  enabledModules: string[]
  subscriptionTemplate: { id: string; name: string } | null
  subscriptionStartsAt: string | null; subscriptionEndsAt: string | null
  daysRemaining: number | null; isExpired: boolean
  maxUsers: number | null; usersUsed: number; usersRemaining: number | null
  _count: { employees: number }
}

const PLAN_LABEL: Record<string, string> = { MONTHLY: 'شهري', QUARTERLY: 'ربع سنوي', ANNUAL: 'سنوي' }
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

const MODULE_LABEL: Record<string, string> = {
  ATTENDANCE: '🕐 الحضور والانصراف', SHIFTS: '🔄 الشفتات', LEAVES: '🌴 الإجازات',
  PAYROLL: '💰 مسير الرواتب', CUSTODY: '📦 العهد', UNIFORMS: '👔 بدلة العمل',
  ONBOARDING: '🚪 المباشرات', APPROVALS: '✅ مسار الاعتماد', ROLES: '🔑 الصلاحيات', AUDIT: '📜 سجل التدقيق',
}
const ALL_MODULES = Object.keys(MODULE_LABEL)
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  TRIAL: { label: 'تجريبي', color: 'warn' }, ACTIVE: { label: 'نشط', color: 'good' },
  EXPIRED: { label: 'منتهٍ', color: 'crit' }, CANCELLED: { label: 'مُلغى', color: 'crit' },
}
const REQ_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'معلّقة', color: 'warn' }, APPROVED: { label: 'مقبولة', color: 'good' }, REJECTED: { label: 'مرفوضة', color: 'crit' },
}

const inp = 'w-full rounded-lg px-3 py-2 text-sm outline-none'
const inpStyle = { background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }

export default function PlatformTenantsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ name: '', subscriptionTemplateId: '', billingCycle: 'MONTHLY', maxUsers: '', ownerFullName: '', ownerEmail: '', ownerPassword: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', maxUsers: '' })
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null)
  const [leaveReqs, setLeaveReqs] = useState<Record<string, LeaveReq[]>>({})
  const [loadingLeaves, setLoadingLeaves] = useState<string | null>(null)
  const [deletingReqId, setDeletingReqId] = useState<string | null>(null)
  const [platformAudit, setPlatformAudit] = useState<Record<string, PlatformAudit[]>>({})

  const load = async () => {
    const token = localStorage.getItem('platform_access_token')
    if (!token) { router.replace('/platform/login'); return }
    setLoading(true)
    const [t, tpl] = await Promise.all([
      platformApi.get('/platform/tenants').then(r => r.data).catch(() => []),
      platformApi.get('/platform/templates').then(r => r.data).catch(() => []),
    ])
    setTenants(t); setTemplates(tpl)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const createTenant = async () => {
    if (!form.name || !form.ownerFullName || !form.ownerEmail || !form.ownerPassword) return
    setSaving(true)
    try {
      await platformApi.post('/platform/tenants', { ...form, maxUsers: form.maxUsers ? Number(form.maxUsers) : undefined })
      setForm({ name: '', subscriptionTemplateId: '', billingCycle: 'MONTHLY', maxUsers: '', ownerFullName: '', ownerEmail: '', ownerPassword: '' })
      setShowCreate(false); load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setSaving(false) }
  }

  const startEdit = (t: Tenant) => {
    setEditingId(t.id)
    setEditForm({ name: t.name, maxUsers: t.maxUsers != null ? String(t.maxUsers) : '' })
  }

  const saveEdit = async (id: string) => {
    setSaving(true)
    try {
      await platformApi.put(`/platform/tenants/${id}`, {
        name: editForm.name,
        maxUsers: editForm.maxUsers === '' ? null : Number(editForm.maxUsers),
      })
      setEditingId(null); load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setSaving(false) }
  }

  const uploadLogo = async (id: string, file: File) => {
    setUploadingLogo(id)
    const fd = new FormData()
    fd.append('logo', file)
    try {
      await platformApi.post(`/platform/tenants/${id}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'فشل رفع الشعار') }
    finally { setUploadingLogo(null) }
  }

  const toggleModule = async (tenant: Tenant, mod: string) => {
    const next = tenant.enabledModules.includes(mod)
      ? tenant.enabledModules.filter(m => m !== mod)
      : [...tenant.enabledModules, mod]
    await platformApi.put(`/platform/tenants/${tenant.id}/modules`, { modules: next }).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  const extend = async (id: string, billingCycle: string) => {
    await platformApi.put(`/platform/tenants/${id}/extend`, { billingCycle }).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  const suspend = async (id: string, name: string) => {
    if (!confirm(`تعليق اشتراك "${name}"؟ لن يستطيع أي موظف فيها تسجيل الدخول.`)) return
    await platformApi.put(`/platform/tenants/${id}/suspend`).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  const reactivate = async (id: string, name: string) => {
    if (!confirm(`إعادة تفعيل اشتراك "${name}"؟ سيستطيع موظفوها تسجيل الدخول مجدداً.`)) return
    await platformApi.put(`/platform/tenants/${id}/reactivate`).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  const loadLeaveRequests = async (tenantId: string) => {
    setLoadingLeaves(tenantId)
    try {
      const r = await platformApi.get(`/platform/tenants/${tenantId}/leave-requests`)
      setLeaveReqs(prev => ({ ...prev, [tenantId]: r.data }))
    } catch { /* تجاهل — القسم يظهر فارغاً */ }
    finally { setLoadingLeaves(null) }
  }

  const loadPlatformAudit = async (tenantId: string) => {
    try {
      const r = await platformApi.get(`/platform/tenants/${tenantId}/platform-audit`)
      setPlatformAudit(prev => ({ ...prev, [tenantId]: r.data }))
    } catch { /* تجاهل */ }
  }

  const toggleExpand = (t: Tenant) => {
    const next = expanded === t.id ? null : t.id
    setExpanded(next)
    if (next && !leaveReqs[t.id]) loadLeaveRequests(t.id)
    if (next && !platformAudit[t.id]) loadPlatformAudit(t.id)
  }

  const deleteLeaveRequest = async (tenantId: string, reqId: string) => {
    if (!confirm('حذف طلب الإجازة هذا من سجل الشركة؟ سيختفي عن الشركة تماماً، لكنه يبقى محفوظاً هنا في سجلك.')) return
    setDeletingReqId(reqId)
    try {
      await platformApi.delete(`/platform/tenants/${tenantId}/leave-requests/${reqId}`)
      loadLeaveRequests(tenantId)
      loadPlatformAudit(tenantId)
    } catch (e: any) { alert(e.response?.data?.message ?? 'خطأ في الحذف') }
    finally { setDeletingReqId(null) }
  }

  const impersonate = async (id: string, name: string) => {
    if (!confirm(`الدخول كإدارة شركة "${name}"؟\n\nستُفتح لوحة تحكم الشركة بكامل صلاحيات المدير في تبويب جديد، وتنتهي الجلسة تلقائياً بعد 15 دقيقة بلا تمديد.`)) return
    try {
      const r = await platformApi.post(`/platform/tenants/${id}/impersonate`)
      const url = `${window.location.origin}/impersonate?t=${encodeURIComponent(r.data.accessToken)}`
      window.open(url, '_blank')
      loadPlatformAudit(id)
    } catch (e: any) { alert(e.response?.data?.message ?? 'خطأ') }
  }

  const logout = () => { localStorage.removeItem('platform_access_token'); router.push('/platform/login') }

  if (loading) return <div className="p-6 text-center" style={{ color: 'var(--ink-3)' }}>جارٍ التحميل...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--brand)' }}>لوحة مالك المنصة</p>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--ink)' }}>الشركات المشتركة</h1>
        </div>
        <div className="flex items-center gap-2">
          <a href="/platform/dashboard" className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--brand)' }}>📊 الداشبورد</a>
          <a href="/platform/plans" className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--brand)' }}>📋 خطط الاشتراك</a>
          <button onClick={() => setShowCreate(v => !v)} className="text-sm font-semibold text-white px-4 py-2 rounded-lg" style={{ background: 'var(--brand)' }}>
            {showCreate ? '✕ إلغاء' : '+ شركة جديدة'}
          </button>
          <button onClick={logout} className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--ink-3)' }}>خروج</button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--ink)' }}>إنشاء شركة جديدة</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>اسم الشركة *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} style={inpStyle} /></div>
            <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>خطة الاشتراك</label>
              <select value={form.subscriptionTemplateId} onChange={e => setForm(f => ({ ...f, subscriptionTemplateId: e.target.value }))} className={inp} style={inpStyle}>
                <option value="">— بلا وحدات، تُخصَّص لاحقاً —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select></div>
            <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>دورة الفوترة</label>
              <select value={form.billingCycle} onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value }))} className={inp} style={inpStyle}>
                <option value="MONTHLY">شهري</option><option value="QUARTERLY">ربع سنوي</option><option value="ANNUAL">سنوي</option>
              </select></div>
            <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>اسم مدير الشركة *</label>
              <input value={form.ownerFullName} onChange={e => setForm(f => ({ ...f, ownerFullName: e.target.value }))} className={inp} style={inpStyle} /></div>
            <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>بريد المدير *</label>
              <input type="email" value={form.ownerEmail} onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))} className={inp} style={inpStyle} /></div>
            <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>كلمة مرور المدير *</label>
              <input type="password" value={form.ownerPassword} onChange={e => setForm(f => ({ ...f, ownerPassword: e.target.value }))} className={inp} style={inpStyle} /></div>
            <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>الحد الأقصى للمستخدمين</label>
              <input type="number" min={1} placeholder="بلا حد" value={form.maxUsers} onChange={e => setForm(f => ({ ...f, maxUsers: e.target.value }))} className={inp} style={inpStyle} /></div>
          </div>
          <button onClick={createTenant} disabled={saving} className="text-sm font-semibold text-white px-5 py-2 rounded-lg disabled:opacity-50" style={{ background: 'var(--brand)' }}>
            {saving ? '⏳ جارٍ الإنشاء...' : '✓ إنشاء الشركة'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {tenants.length === 0 ? (
          <div className="text-center py-14 rounded-2xl" style={{ background: 'var(--surface)', border: '1px dashed var(--line-strong)', color: 'var(--ink-3)' }}>
            لا توجد شركات بعد — أنشئ أول شركة
          </div>
        ) : tenants.map(t => {
          const st = STATUS_LABEL[t.planStatus] ?? { label: t.planStatus, color: 'ink-3' }
          const seatPct = t.maxUsers ? Math.min(100, Math.round((t.usersUsed / t.maxUsers) * 100)) : null
          return (
            <div key={t.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={() => toggleExpand(t)}>
                <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center text-lg font-bold"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
                  {t.logo ? (
                    <img src={`${process.env.NEXT_PUBLIC_API_URL}${t.logo}`} alt={t.name} className="w-full h-full object-cover" />
                  ) : t.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                    {t._count.employees} موظف · {t.enabledModules.length} أقسام مفعّلة
                    {t.subscriptionTemplate ? ` · خطة ${t.subscriptionTemplate.name}` : ''}
                  </p>
                </div>
                {seatPct !== null && (
                  <span className="text-xs tabular-nums" style={{ color: seatPct >= 100 ? 'var(--crit)' : 'var(--ink-3)' }}>
                    👤 {t.usersUsed}/{t.maxUsers}
                  </span>
                )}
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `var(--${st.color}-soft)`, color: `var(--${st.color})` }}>{st.label}</span>
                {t.daysRemaining !== null && (
                  <span className="text-xs tabular-nums" style={{ color: t.isExpired ? 'var(--crit)' : 'var(--ink-3)' }}>
                    {t.isExpired ? 'منتهٍ' : `${t.daysRemaining} يوم متبقٍ`}
                  </span>
                )}
                <span style={{ color: 'var(--ink-3)' }}>{expanded === t.id ? '▲' : '▼'}</span>
              </div>

              {expanded === t.id && (
                <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--line)' }}>
                  <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
                    <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)' }}>
                      <p className="text-xs font-bold mb-2" style={{ color: 'var(--ink-2)' }}>📅 تفاصيل الاشتراك</p>
                      <div className="text-xs space-y-1" style={{ color: 'var(--ink-3)' }}>
                        <p>بداية الاشتراك: <span style={{ color: 'var(--ink)' }}>{fmtDate(t.subscriptionStartsAt)}</span></p>
                        <p>نهاية الاشتراك: <span style={{ color: t.isExpired ? 'var(--crit)' : 'var(--ink)' }}>{fmtDate(t.subscriptionEndsAt)}</span></p>
                        <p>دورة الفوترة: <span style={{ color: 'var(--ink)' }}>{PLAN_LABEL[t.plan] ?? t.plan}</span></p>
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)' }}>
                      <p className="text-xs font-bold mb-2" style={{ color: 'var(--ink-2)' }}>👥 استخدام المقاعد</p>
                      {t.maxUsers != null ? (
                        <>
                          <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--line)' }}>
                            <div className="h-full rounded-full" style={{ width: `${seatPct}%`, background: seatPct! >= 100 ? 'var(--crit)' : seatPct! >= 80 ? 'var(--warn)' : 'var(--good)' }} />
                          </div>
                          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                            {t.usersUsed} مستخدَم من {t.maxUsers} · متبقٍ {t.usersRemaining}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{t.usersUsed} مستخدَم · بلا حد أقصى</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--surface-2)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold" style={{ color: 'var(--ink-2)' }}>🏷️ بيانات الشركة والشعار</p>
                      {editingId !== t.id && (
                        <button onClick={() => startEdit(t)} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--brand)' }}>✎ تعديل</button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center text-xl font-bold"
                        style={{ background: 'var(--surface)', color: 'var(--ink-3)' }}>
                        {t.logo ? (
                          <img src={`${process.env.NEXT_PUBLIC_API_URL}${t.logo}`} alt={t.name} className="w-full h-full object-cover" />
                        ) : t.name.charAt(0)}
                      </div>
                      <label className="text-xs px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}>
                        {uploadingLogo === t.id ? '⏳ جارٍ الرفع...' : '📤 رفع شعار'}
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(t.id, f) }} />
                      </label>
                    </div>
                    {editingId === t.id && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>اسم الشركة</label>
                          <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inp} style={inpStyle} /></div>
                        <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>الحد الأقصى للمستخدمين</label>
                          <input type="number" min={1} placeholder="بلا حد" value={editForm.maxUsers} onChange={e => setEditForm(f => ({ ...f, maxUsers: e.target.value }))} className={inp} style={inpStyle} /></div>
                        <div className="col-span-2 flex gap-2">
                          <button onClick={() => saveEdit(t.id)} disabled={saving} className="text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: 'var(--brand)' }}>
                            {saving ? '⏳ جارٍ الحفظ...' : '✓ حفظ'}
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-xs px-4 py-2 rounded-lg" style={{ color: 'var(--ink-3)' }}>إلغاء</button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {ALL_MODULES.map(mod => {
                      const on = t.enabledModules.includes(mod)
                      return (
                        <button key={mod} onClick={() => toggleModule(t, mod)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
                          style={on ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
                          {MODULE_LABEL[mod]}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <a href={`/platform/tenants/${t.id}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      👥 إدارة الموظفين والبيانات
                    </a>
                    <button onClick={() => impersonate(t.id, t.name)} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                      🔑 دخول كإدارة الشركة — تحكّم كامل بلا قيود أدوار
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--ink-3)' }}>تمديد الاشتراك:</span>
                    {[['MONTHLY', 'شهر'], ['QUARTERLY', '3 أشهر'], ['ANNUAL', 'سنة']].map(([v, l]) => (
                      <button key={v} onClick={() => extend(t.id, v)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}>
                        +{l}
                      </button>
                    ))}
                    <div className="flex-1" />
                    {t.planStatus === 'CANCELLED' || t.planStatus === 'EXPIRED' ? (
                      <button onClick={() => reactivate(t.id, t.name)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}>
                        ✓ إعادة تفعيل
                      </button>
                    ) : (
                      <button onClick={() => suspend(t.id, t.name)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--crit-soft)', color: 'var(--crit)' }}>
                        تعليق الاشتراك
                      </button>
                    )}
                  </div>

                  {/* طلبات الإجازة — حذف حصري لمالك المنصة، والحذف يُخفي عن الشركة فقط ولا يمسح السجل */}
                  <div className="rounded-xl p-4 mt-4" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-xs font-bold mb-2" style={{ color: 'var(--ink-2)' }}>🌴 طلبات الإجازة (حذف المقبولة أو المعلّقة فقط — يبقى السجل محفوظاً هنا)</p>
                    {loadingLeaves === t.id ? (
                      <p className="text-xs" style={{ color: 'var(--ink-3)' }}>جارٍ التحميل...</p>
                    ) : !leaveReqs[t.id]?.length ? (
                      <p className="text-xs" style={{ color: 'var(--ink-3)' }}>لا توجد طلبات إجازة</p>
                    ) : (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {leaveReqs[t.id].map(r => {
                          const rs = REQ_STATUS_LABEL[r.status] ?? { label: r.status, color: 'ink-3' }
                          const canDelete = !r.hiddenFromTenant && (r.status === 'APPROVED' || r.status === 'PENDING')
                          return (
                            <div key={r.id} className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5" style={{ background: 'var(--surface)', opacity: r.hiddenFromTenant ? 0.55 : 1 }}>
                              <span className="font-medium flex-shrink-0" style={{ color: 'var(--ink)' }}>{r.employee.fullName}</span>
                              <span style={{ color: 'var(--ink-3)' }}>{r.leaveType.name}</span>
                              <span style={{ color: 'var(--ink-3)' }}>{fmtDate(r.startDate)} ← {fmtDate(r.endDate)}</span>
                              <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: `var(--${rs.color}-soft)`, color: `var(--${rs.color})` }}>{rs.label}</span>
                              {r.hiddenFromTenant && (
                                <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>🙈 مخفي عن الشركة</span>
                              )}
                              <div className="flex-1" />
                              {canDelete && (
                                <button onClick={() => deleteLeaveRequest(t.id, r.id)} disabled={deletingReqId === r.id}
                                  className="px-2 py-1 rounded-lg disabled:opacity-50" style={{ background: 'var(--crit-soft)', color: 'var(--crit)' }}>
                                  {deletingReqId === r.id ? '...' : '🗑'}
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* سجل تدقيق مالك المنصة — منفصل تماماً عن سجل تدقيق الشركة، لا تراه الشركة أبداً */}
                  <div className="rounded-xl p-4 mt-4" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-xs font-bold mb-2" style={{ color: 'var(--ink-2)' }}>🕵️ سجل تدقيق مالك المنصة (خاص بك — لا تراه الشركة)</p>
                    {!platformAudit[t.id]?.length ? (
                      <p className="text-xs" style={{ color: 'var(--ink-3)' }}>لا توجد إجراءات مسجّلة بعد</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {platformAudit[t.id].map(a => (
                          <div key={a.id} className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5" style={{ background: 'var(--surface)' }}>
                            <span style={{ color: 'var(--ink)' }}>{PLATFORM_ACTION_LABEL[a.action] ?? a.action}</span>
                            <div className="flex-1" />
                            <span style={{ color: 'var(--ink-3)' }}>{new Date(a.createdAt).toLocaleString('ar-SA')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
