'use client'
import { useState, useEffect } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { ThemeToggle } from '../../../components/layout/theme-toggle'

/* ══════════ الأنواع ══════════ */
interface RoleOption { id: string; name: string }
type ApproverKind = 'ROLE' | 'DEPT_HEAD' | 'BRANCH_MANAGER'
interface StepRow {
  id: string; order: number; label: string
  approverKind: ApproverKind; roleId: string | null; roleName: string | null
}
interface WorkflowInfo {
  type: 'LEAVE' | 'UNIFORM' | 'ONBOARDING'
  label: string; configured: boolean; workflowId: string | null; steps: StepRow[]
}

const KIND_LABELS: Record<ApproverKind, string> = {
  DEPT_HEAD: 'رئيس القسم (هيكلي)',
  BRANCH_MANAGER: 'مدير الفرع (هيكلي)',
  ROLE: 'دور نظام محدّد',
}
const KIND_ICON: Record<ApproverKind, string> = { DEPT_HEAD: '🏛️', BRANCH_MANAGER: '🏢', ROLE: '🔑' }
const KIND_HINT: Record<ApproverKind, string> = {
  DEPT_HEAD: 'يُحدَّد تلقائياً من رئيس قسم مقدّم الطلب — عيّنه من الهيكل التنظيمي',
  BRANCH_MANAGER: 'يُحدَّد تلقائياً من مدير فرع مقدّم الطلب — عيّنه من الهيكل التنظيمي',
  ROLE: 'أي موظف يحمل هذا الدور',
}
const TYPE_ICON: Record<string, string> = { LEAVE: '🌴', UNIFORM: '👔', ONBOARDING: '🚪' }

let uid = 0
const nextLocalId = () => `local-${++uid}-${Date.now()}`

export default function ApprovalsPage() {
  useAuth()
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([])
  const [roles, setRoles]         = useState<RoleOption[]>([])
  const [active, setActive]       = useState<'LEAVE' | 'UNIFORM' | 'ONBOARDING'>('LEAVE')
  const [loading, setLoading]     = useState(true)
  const [seeding, setSeeding]     = useState(false)

  const load = async () => {
    setLoading(true)
    const [wf, rl] = await Promise.all([
      api.get('/approvals/workflows').then(r => r.data).catch(() => []),
      api.get('/roles').then(r => r.data).catch(() => []),
    ])
    setWorkflows(wf)
    setRoles(rl)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const seedDefaults = async () => {
    setSeeding(true)
    try { const r = await api.post('/approvals/workflows/seed-defaults'); alert(r.data.message); load() }
    catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setSeeding(false) }
  }

  const anyConfigured = workflows.some(w => w.configured)
  const current = workflows.find(w => w.type === active)

  return (
    <div style={{ background: 'var(--ground)', minHeight: '100%' }} className="p-6">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-start gap-3 mb-2 reveal">
          <div className="flex-1">
            <p className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--brand)' }}>إعدادات · شؤون الموظفين</p>
            <h1 className="text-2xl font-extrabold mt-0.5" style={{ color: 'var(--ink)' }}>مسار الاعتماد</h1>
            <p className="text-sm mt-1 max-w-xl" style={{ color: 'var(--ink-2)' }}>
              حدّد سلسلة اعتماد كل نوع طلب حسب هيكلة شركتك — من <b style={{ color: 'var(--ink)' }}>الموظف</b> حتى <b style={{ color: 'var(--ink)' }}>شؤون الموظفين</b>.
            </p>
          </div>
          <ThemeToggle className="w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0" />
        </div>

        {!anyConfigured && !loading && (
          <div className="flex items-center justify-between rounded-xl px-4 py-3 my-4"
            style={{ background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
            <p className="text-sm" style={{ color: 'var(--ink)' }}>لا توجد مسارات مُهيّأة بعد — الاعتماد حالياً مباشر من الإدارة.</p>
            <button onClick={seedDefaults} disabled={seeding}
              className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white flex-shrink-0"
              style={{ background: 'var(--accent)' }}>
              {seeding ? '⏳ جارٍ...' : '✨ إنشاء مسارات مقترحة'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16" style={{ color: 'var(--ink-3)' }}>جارٍ التحميل...</div>
        ) : (
          <>
            {/* تبويبات الأنواع */}
            <div className="flex gap-1 p-1 rounded-xl w-fit mt-4 mb-4" style={{ background: 'var(--surface-2)' }}>
              {workflows.map(w => (
                <button key={w.type} onClick={() => setActive(w.type)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                  style={active === w.type
                    ? { background: 'var(--surface)', color: 'var(--brand)', boxShadow: 'var(--shadow)' }
                    : { color: 'var(--ink-2)' }}>
                  <span>{TYPE_ICON[w.type]}</span>
                  {w.label}
                  {w.configured && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--good)' }} />}
                </button>
              ))}
            </div>

            {current && <WorkflowCard workflow={current} roles={roles} onSaved={load} />}
          </>
        )}
      </div>
    </div>
  )
}

/* ══════════ بطاقة مسار واحد — بعرض السلسلة ══════════ */
function WorkflowCard({ workflow, roles, onSaved }: { workflow: WorkflowInfo; roles: RoleOption[]; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [steps, setSteps]     = useState<StepRow[]>(workflow.steps)
  const [saving, setSaving]   = useState(false)

  useEffect(() => { setSteps(workflow.steps); setEditing(false) }, [workflow])

  const addStep = () => setSteps(s => [...s, { id: nextLocalId(), order: s.length + 1, label: '', approverKind: 'DEPT_HEAD', roleId: null, roleName: null }])
  const removeStep = (id: string) => setSteps(s => s.filter(x => x.id !== id).map((x, i) => ({ ...x, order: i + 1 })))
  const moveStep = (id: string, dir: -1 | 1) => {
    setSteps(s => {
      const idx = s.findIndex(x => x.id === id); const swap = idx + dir
      if (swap < 0 || swap >= s.length) return s
      const copy = [...s]; [copy[idx], copy[swap]] = [copy[swap], copy[idx]]
      return copy.map((x, i) => ({ ...x, order: i + 1 }))
    })
  }
  const updateStep = (id: string, patch: Partial<StepRow>) => setSteps(s => s.map(x => x.id === id ? { ...x, ...patch } : x))

  const save = async () => {
    if (steps.length === 0) { alert('أضف خطوة واحدة على الأقل'); return }
    for (const s of steps) {
      if (!s.label.trim()) { alert('لكل خطوة اسم — أكمل الحقول الفارغة'); return }
      if (s.approverKind === 'ROLE' && !s.roleId) { alert(`الخطوة "${s.label}" من نوع دور — اختر الدور`); return }
    }
    setSaving(true)
    try {
      await api.put(`/approvals/workflows/${workflow.type}`, {
        steps: steps.map(s => ({ label: s.label.trim(), approverKind: s.approverKind, roleId: s.approverKind === 'ROLE' ? s.roleId : undefined })),
      })
      setEditing(false); onSaved()
    } catch (e: any) { alert(e.response?.data?.message ?? 'حدث خطأ') }
    finally { setSaving(false) }
  }

  return (
    <section className="rounded-2xl overflow-hidden reveal" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
      <header className="flex items-center gap-3 px-5 pt-5 pb-4">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
          {TYPE_ICON[workflow.type]}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>مسار اعتماد {workflow.label}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
            {workflow.configured ? `${workflow.steps.length} خطوات · نشط` : 'لا يوجد مسار مُهيّأ — اعتماد مباشر من الإدارة'}
          </p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-sm font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
            style={{ color: 'var(--brand)' }}>
            {workflow.configured ? '✎ تعديل المسار' : '+ إنشاء مسار'}
          </button>
        )}
      </header>

      <div className="px-5 pb-5">
        {/* عرض السلسلة */}
        <div className="flex items-start gap-0 overflow-x-auto pb-2">
          <div className="text-center flex-shrink-0" style={{ width: 74 }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1.5 text-base"
              style={{ background: 'var(--surface)', border: '1.5px dashed var(--line-strong)' }}>👤</div>
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>الموظف</p>
          </div>

          {(editing ? steps : workflow.steps).map((s, i) => (
            <div key={s.id} className="flex items-start flex-shrink-0">
              <div className="flex-shrink-0" style={{ width: 30, height: 2, background: 'var(--line-strong)', marginTop: 34 }} />
              <div className="relative rounded-xl p-3" style={{ width: editing ? 210 : 168, border: '1.5px solid var(--line)', background: 'var(--surface-2)' }}>
                <span className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full text-white text-xs font-extrabold flex items-center justify-center tabular-nums"
                  style={{ background: 'var(--accent)' }}>{i + 1}</span>

                {editing ? (
                  <div className="space-y-2">
                    <input value={s.label} onChange={e => updateStep(s.id, { label: e.target.value })} placeholder="اسم الخطوة"
                      className="w-full text-sm rounded-lg px-2 py-1.5 outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
                    <select value={s.approverKind} onChange={e => updateStep(s.id, { approverKind: e.target.value as ApproverKind, roleId: null })}
                      className="w-full text-xs rounded-lg px-2 py-1.5 outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                      {(Object.keys(KIND_LABELS) as ApproverKind[]).map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                    </select>
                    {s.approverKind === 'ROLE' && (
                      <select value={s.roleId ?? ''} onChange={e => updateStep(s.id, { roleId: e.target.value })}
                        className="w-full text-xs rounded-lg px-2 py-1.5 outline-none"
                        style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                        <option value="">— اختر الدور —</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    )}
                    <div className="flex gap-1 justify-end pt-0.5">
                      <button onClick={() => moveStep(s.id, -1)} disabled={i === 0} className="w-6 h-6 rounded text-xs disabled:opacity-20" style={{ color: 'var(--ink-3)' }}>▲</button>
                      <button onClick={() => moveStep(s.id, 1)} disabled={i === steps.length - 1} className="w-6 h-6 rounded text-xs disabled:opacity-20" style={{ color: 'var(--ink-3)' }}>▼</button>
                      <button onClick={() => removeStep(s.id)} className="w-6 h-6 rounded text-xs" style={{ color: 'var(--crit)' }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-xl block mb-1.5">{KIND_ICON[s.approverKind]}</span>
                    <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{s.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                      {s.approverKind === 'ROLE' ? `دور نظام${s.roleName ? ` — ${s.roleName}` : ''}` : KIND_LABELS[s.approverKind]}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}

          {editing && (
            <div className="flex-shrink-0 flex items-start" style={{ paddingTop: 6 }}>
              <div className="flex-shrink-0" style={{ width: 20, height: 2, background: 'var(--line-strong)', marginTop: 28 }} />
              <button onClick={addStep} className="rounded-xl flex items-center justify-center text-xs"
                style={{ width: 88, height: 66, border: '1.5px dashed var(--line-strong)', color: 'var(--ink-3)' }}>
                + خطوة
              </button>
            </div>
          )}
        </div>

        {editing && (
          <>
            <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 mt-3" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
              💡 {KIND_HINT[steps.find(s => s.approverKind !== 'ROLE')?.approverKind ?? 'DEPT_HEAD']}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={save} disabled={saving} className="text-sm font-semibold px-4 py-2 rounded-lg text-white"
                style={{ background: 'var(--brand)' }}>{saving ? '⏳ جارٍ الحفظ...' : '✓ حفظ المسار'}</button>
              <button onClick={() => { setSteps(workflow.steps); setEditing(false) }} className="text-sm px-3 py-2 rounded-lg"
                style={{ border: '1px solid var(--line)', color: 'var(--ink-2)' }}>إلغاء</button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
