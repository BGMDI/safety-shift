'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { platformApi } from '../../../lib/platform-api'

interface Template { id: string; name: string; modules: string[]; monthlyPrice: string | null; isActive: boolean; _count: { tenants: number } }

const MODULE_LABEL: Record<string, string> = {
  ATTENDANCE: '🕐 الحضور والانصراف', SHIFTS: '🔄 الشفتات', LEAVES: '🌴 الإجازات',
  PAYROLL: '💰 مسير الرواتب', CUSTODY: '📦 العهد', UNIFORMS: '👔 بدلة العمل',
  ONBOARDING: '🚪 المباشرات', APPROVALS: '✅ مسار الاعتماد', ROLES: '🔑 الصلاحيات', AUDIT: '📜 سجل التدقيق',
}
const ALL_MODULES = Object.keys(MODULE_LABEL)

const inp = 'w-full rounded-lg px-3 py-2 text-sm outline-none'
const inpStyle = { background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }

export default function PlatformPlansPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ name: string; modules: string[]; monthlyPrice: string }>({ name: '', modules: [], monthlyPrice: '' })

  const load = async () => {
    const token = localStorage.getItem('platform_access_token')
    if (!token) { router.replace('/platform/login'); return }
    setLoading(true)
    const r = await platformApi.get('/platform/templates').catch(() => ({ data: [] }))
    setTemplates(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggleMod = (mod: string) => setForm(f => ({
    ...f, modules: f.modules.includes(mod) ? f.modules.filter(m => m !== mod) : [...f.modules, mod],
  }))

  const create = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await platformApi.post('/platform/templates', { name: form.name, modules: form.modules, monthlyPrice: form.monthlyPrice ? Number(form.monthlyPrice) : undefined })
      setForm({ name: '', modules: [], monthlyPrice: '' }); setShowCreate(false); load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setSaving(false) }
  }

  const toggleTemplateModule = async (tpl: Template, mod: string) => {
    const next = tpl.modules.includes(mod) ? tpl.modules.filter(m => m !== mod) : [...tpl.modules, mod]
    await platformApi.put(`/platform/templates/${tpl.id}`, { modules: next }).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  const remove = async (tpl: Template) => {
    if (tpl._count.tenants > 0) { alert(`لا يمكن حذف الخطة — ${tpl._count.tenants} شركة تستخدمها`); return }
    if (!confirm(`حذف خطة "${tpl.name}"؟`)) return
    await platformApi.delete(`/platform/templates/${tpl.id}`).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  if (loading) return <div className="p-6 text-center" style={{ color: 'var(--ink-3)' }}>جارٍ التحميل...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/platform/tenants" className="text-xs" style={{ color: 'var(--brand)' }}>← الشركات المشتركة</a>
          <h1 className="text-2xl font-extrabold mt-1" style={{ color: 'var(--ink)' }}>خطط الاشتراك</h1>
        </div>
        <button onClick={() => setShowCreate(v => !v)} className="text-sm font-semibold text-white px-4 py-2 rounded-lg" style={{ background: 'var(--brand)' }}>
          {showCreate ? '✕ إلغاء' : '+ خطة جديدة'}
        </button>
      </div>

      {showCreate && (
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>اسم الخطة *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="أساسي، احترافي، متكامل..." className={inp} style={inpStyle} /></div>
            <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-2)' }}>السعر الشهري (اختياري)</label>
              <input type="number" min="0" value={form.monthlyPrice} onChange={e => setForm(f => ({ ...f, monthlyPrice: e.target.value }))} className={inp} style={inpStyle} /></div>
          </div>
          <p className="text-xs mb-2" style={{ color: 'var(--ink-2)' }}>الأقسام المتضمّنة:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {ALL_MODULES.map(mod => (
              <button key={mod} onClick={() => toggleMod(mod)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
                style={form.modules.includes(mod) ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
                {MODULE_LABEL[mod]}
              </button>
            ))}
          </div>
          <button onClick={create} disabled={saving || !form.name.trim()} className="text-sm font-semibold text-white px-5 py-2 rounded-lg disabled:opacity-50" style={{ background: 'var(--brand)' }}>
            {saving ? '⏳ جارٍ الإنشاء...' : '✓ حفظ الخطة'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {templates.length === 0 ? (
          <div className="text-center py-14 rounded-2xl" style={{ background: 'var(--surface)', border: '1px dashed var(--line-strong)', color: 'var(--ink-3)' }}>
            لا توجد خطط بعد
          </div>
        ) : templates.map(tpl => (
          <div key={tpl.id} className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{tpl.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                  {tpl._count.tenants} شركة تستخدمها{tpl.monthlyPrice ? ` · ${tpl.monthlyPrice} ر.س / شهر` : ''}
                </p>
              </div>
              <button onClick={() => remove(tpl)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--crit)' }}>حذف</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map(mod => {
                const on = tpl.modules.includes(mod)
                return (
                  <button key={mod} onClick={() => toggleTemplateModule(tpl, mod)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
                    style={on ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
                    {MODULE_LABEL[mod]}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
