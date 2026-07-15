'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface Role {
  id: string
  name: string
  employeeCount: number
  isProtected: boolean
}

interface EmployeeWithRoles {
  id: string
  fullName: string
  employeeCode: string
  photo: string | null
  jobTitle: { name: string } | null
  employeeRoles: { id: string; role: { id: string; name: string } }[]
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'مدير النظام',
  hr_manager:  'مدير الموارد البشرية',
  supervisor:  'مشرف',
  employee:    'موظف',
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700 border-red-200',
  hr_manager:  'bg-purple-100 text-purple-700 border-purple-200',
  supervisor:  'bg-blue-100 text-blue-700 border-blue-200',
  employee:    'bg-gray-100 text-gray-600 border-gray-200',
}

function roleLabel(name: string) { return ROLE_LABELS[name] ?? name }
function roleColor(name: string) { return ROLE_COLORS[name] ?? 'bg-green-100 text-green-700 border-green-200' }

export default function RolesPage() {
  useAuth()

  const [tab, setTab] = useState<'employees' | 'roles'>('employees')

  /* ── الأدوار ── */
  const [roles, setRoles] = useState<Role[]>([])
  const [newRoleName, setNewRoleName] = useState('')
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [editName, setEditName] = useState('')
  const [roleLoading, setRoleLoading] = useState(false)
  const [roleError, setRoleError] = useState('')

  /* ── الموظفون ── */
  const [employees, setEmployees] = useState<EmployeeWithRoles[]>([])
  const [empSearch, setEmpSearch] = useState('')
  const [empLoading, setEmpLoading] = useState(false)
  const [toggling, setToggling] = useState<string>('')   // `${empId}-${roleId}`

  /* ── جلب البيانات ── */
  const fetchRoles = useCallback(async () => {
    const r = await api.get('/roles')
    setRoles(r.data)
  }, [])

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true)
    try {
      const params = empSearch ? `?search=${encodeURIComponent(empSearch)}` : ''
      const r = await api.get(`/roles/employees${params}`)
      setEmployees(r.data)
    } finally { setEmpLoading(false) }
  }, [empSearch])

  useEffect(() => { fetchRoles() }, [fetchRoles])
  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  /* ══ إنشاء الأدوار الافتراضية ══ */
  const seedDefaults = async () => {
    setRoleLoading(true); setRoleError('')
    try { await api.post('/roles/seed-defaults'); await fetchRoles() }
    catch (e: any) { setRoleError(e.response?.data?.message ?? 'خطأ') }
    finally { setRoleLoading(false) }
  }

  /* ══ إضافة دور ══ */
  const createRole = async () => {
    if (!newRoleName.trim()) return
    setRoleLoading(true); setRoleError('')
    try {
      await api.post('/roles', { name: newRoleName.trim() })
      setNewRoleName('')
      await fetchRoles()
    } catch (e: any) { setRoleError(e.response?.data?.message ?? 'خطأ') }
    finally { setRoleLoading(false) }
  }

  /* ══ تعديل دور ══ */
  const updateRole = async () => {
    if (!editRole || !editName.trim()) return
    setRoleLoading(true); setRoleError('')
    try {
      await api.put(`/roles/${editRole.id}`, { name: editName.trim() })
      setEditRole(null)
      await fetchRoles()
    } catch (e: any) { setRoleError(e.response?.data?.message ?? 'خطأ') }
    finally { setRoleLoading(false) }
  }

  /* ══ حذف دور ══ */
  const deleteRole = async (role: Role) => {
    if (!confirm(`حذف الدور "${roleLabel(role.name)}"؟ سيُزال من جميع الموظفين.`)) return
    setRoleLoading(true); setRoleError('')
    try { await api.delete(`/roles/${role.id}`); await fetchRoles() }
    catch (e: any) { setRoleError(e.response?.data?.message ?? 'خطأ') }
    finally { setRoleLoading(false) }
  }

  /* ══ تبديل دور موظف (إضافة / إزالة) ══ */
  const toggleRole = async (emp: EmployeeWithRoles, role: Role) => {
    const key = `${emp.id}-${role.id}`
    if (toggling === key) return
    setToggling(key)
    try {
      const hasRole = emp.employeeRoles.some(er => er.role.id === role.id)
      if (hasRole) {
        await api.delete(`/roles/${role.id}/employees/${emp.id}`)
      } else {
        await api.post(`/roles/${role.id}/employees/${emp.id}`)
      }
      await fetchEmployees()
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'حدث خطأ')
    } finally { setToggling('') }
  }

  /* ══ Render ══ */
  return (
    <div className="p-6 max-w-5xl">

      {/* رأس الصفحة */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">إدارة الصلاحيات</h1>
          <p className="text-gray-500 text-sm mt-1">تحديد أدوار الموظفين وصلاحياتهم في النظام</p>
        </div>
      </div>

      {/* تبويبات */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {([['employees','👥 تعيين الأدوار للموظفين'], ['roles','🔑 إدارة الأدوار']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
            }`}>{label}</button>
        ))}
      </div>

      {/* ════════ تبويب: تعيين الأدوار للموظفين ════════ */}
      {tab === 'employees' && (
        <div className="space-y-4">
          {/* بحث */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <input
              type="text" value={empSearch}
              onChange={e => setEmpSearch(e.target.value)}
              placeholder="بحث باسم الموظف أو الكود..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* جدول الموظفين */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {empLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">جاري التحميل...</div>
            ) : employees.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-gray-400">لا يوجد موظفون</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">الموظف</th>
                    {roles.map(r => (
                      <th key={r.id} className="px-3 py-3 text-center font-medium text-gray-600 text-xs min-w-[90px]">
                        <span className={`px-2 py-0.5 rounded-full border text-xs ${roleColor(r.name)}`}>
                          {roleLabel(r.name)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      {/* الموظف */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                            {emp.photo
                              ? <img src={`${API_URL}${emp.photo}`} alt={emp.fullName} className="w-full h-full object-cover" />
                              : <span className="text-blue-500 font-bold text-xs">{emp.fullName.charAt(0)}</span>
                            }
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{emp.fullName}</p>
                            <p className="text-xs text-gray-400">{emp.jobTitle?.name ?? ''} · {emp.employeeCode}</p>
                          </div>
                        </div>
                      </td>
                      {/* خانة اختيار لكل دور */}
                      {roles.map(role => {
                        const hasRole = emp.employeeRoles.some(er => er.role.id === role.id)
                        const key = `${emp.id}-${role.id}`
                        const busy = toggling === key
                        return (
                          <td key={role.id} className="px-3 py-3 text-center">
                            <button
                              onClick={() => toggleRole(emp, role)}
                              disabled={busy}
                              className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center mx-auto ${
                                hasRole
                                  ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                                  : 'border-gray-200 text-gray-300 hover:border-blue-400 hover:text-blue-400'
                              } ${busy ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                            >
                              {busy ? (
                                <span className="text-xs">⏳</span>
                              ) : hasRole ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ملاحظة */}
          <p className="text-xs text-gray-400 text-center">
            انقر على الدائرة لإضافة أو إزالة الدور من الموظف — التغيير فوري
          </p>
        </div>
      )}

      {/* ════════ تبويب: إدارة الأدوار ════════ */}
      {tab === 'roles' && (
        <div className="space-y-5">
          {roleError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{roleError}</div>
          )}

          {/* إنشاء الأدوار الافتراضية */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-800 text-sm">الأدوار الافتراضية</p>
              <p className="text-xs text-blue-600 mt-0.5">مدير النظام · مدير الموارد البشرية · مشرف · موظف</p>
            </div>
            <button onClick={seedDefaults} disabled={roleLoading}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              🌱 إنشاء الأدوار الافتراضية
            </button>
          </div>

          {/* إضافة دور جديد */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-3">إضافة دور جديد</h3>
            <div className="flex gap-2">
              <input
                value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createRole()}
                placeholder="اسم الدور (بالإنجليزية أو العربية)..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button onClick={createRole} disabled={roleLoading || !newRoleName.trim()}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                إضافة
              </button>
            </div>
          </div>

          {/* قائمة الأدوار */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {roles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                <p>لا يوجد أدوار بعد</p>
                <p className="text-xs">انقر "إنشاء الأدوار الافتراضية" للبدء</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['الدور', 'عدد الموظفين', 'النوع', ''].map(h => (
                      <th key={h} className="text-right px-4 py-3 font-medium text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {roles.map(role => (
                    <tr key={role.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {editRole?.id === role.id ? (
                          <div className="flex gap-2 items-center">
                            <input value={editName} onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && updateRole()}
                              className="border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-40"
                              autoFocus />
                            <button onClick={updateRole} disabled={roleLoading}
                              className="text-green-600 text-xs px-3 py-1 rounded-lg border border-green-200 hover:bg-green-50">
                              ✓ حفظ
                            </button>
                            <button onClick={() => setEditRole(null)}
                              className="text-gray-400 text-xs px-2 py-1 rounded hover:bg-gray-100">
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${roleColor(role.name)}`}>
                              {roleLabel(role.name)}
                            </span>
                            {role.name !== roleLabel(role.name) && (
                              <span className="text-gray-400 text-xs font-mono">{role.name}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">{role.employeeCount} موظف</span>
                      </td>
                      <td className="px-4 py-3">
                        {role.isProtected
                          ? <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">🔒 أساسي</span>
                          : <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">مخصص</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {!role.isProtected && editRole?.id !== role.id && (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditRole(role); setEditName(role.name) }}
                              className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">
                              تعديل
                            </button>
                            <button onClick={() => deleteRole(role)}
                              className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50">
                              حذف
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* شرح الأدوار */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">صلاحيات كل دور</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { role: 'super_admin', desc: 'وصول كامل لجميع أقسام النظام بما فيها حذف الرواتب واعتمادها وإدارة الصلاحيات' },
                { role: 'hr_manager',  desc: 'إدارة الموظفين والإجازات والرواتب والأقسام — لا يملك حذف مسير الرواتب' },
                { role: 'supervisor',  desc: 'قبول ورفض طلبات الإجازة فقط — لا يملك تعديل بيانات الموظفين' },
                { role: 'employee',    desc: 'وصول للقراءة فقط — لا يستطيع تعديل أي بيانات' },
              ].map(item => (
                <div key={item.role} className={`p-3 rounded-lg border ${roleColor(item.role)}`}>
                  <p className="font-semibold text-xs mb-1">{roleLabel(item.role)}</p>
                  <p className="text-xs opacity-80 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
