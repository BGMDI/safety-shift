'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { platformApi } from '../../../lib/platform-api'

interface Template { id: string; name: string; modules: string[]; monthlyPrice: string | null; isActive: boolean }
interface Tenant {
  id: string; name: string; planStatus: string; plan: string
  enabledModules: string[]
  subscriptionTemplate: { id: string; name: string } | null
  subscriptionStartsAt: string | null; subscriptionEndsAt: string | null
  daysRemaining: number | null; isExpired: boolean
  _count: { employees: number }
}

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

  const [form, setForm] = useState({ name: '', subscriptionTemplateId: '', billingCycle: 'MONTHLY', ownerFullName: '', ownerEmail: '', ownerPassword: '' })

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
      await platformApi.post('/platform/tenants', form)
      setForm({ name: '', subscriptionTemplateId: '', billingCycle: 'MONTHLY', ownerFullName: '', ownerEmail: '', ownerPassword: '' })
      setShowCreate(false); load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setSaving(false) }
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
          return (
            <div key={t.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
              <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                    {t._count.employees} موظف · {t.enabledModules.length} أقسام مفعّلة
                    {t.subscriptionTemplate ? ` · خطة ${t.subscriptionTemplate.name}` : ''}
                  </p>
                </div>
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
                  <div className="flex flex-wrap gap-2 mt-4 mb-4">
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--ink-3)' }}>تمديد الاشتراك:</span>
                    {[['MONTHLY', 'شهر'], ['QUARTERLY', '3 أشهر'], ['ANNUAL', 'سنة']].map(([v, l]) => (
                      <button key={v} onClick={() => extend(t.id, v)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}>
                        +{l}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button onClick={() => suspend(t.id, t.name)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--crit-soft)', color: 'var(--crit)' }}>
                      تعليق الاشتراك
                    </button>
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
