'use client'

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { isHR } from '../lib/auth'

type Result = { total: number; imported: number; rejected: number; errors: { row: number; message: string }[] }

export function EmployeeImport({ onImported }: { onImported: () => void }) {
  const [allowed, setAllowed] = useState(false)
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [branchId, setBranchId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  useEffect(() => { setAllowed(isHR()) }, [])
  useEffect(() => {
    if (!open) return
    api.get('/branches').then(({ data }) => setBranches(data)).catch(() => setError('تعذر تحميل الفروع'))
  }, [open])

  async function download() {
    setError('')
    try {
      const { data } = await api.get('/employees/import-template', { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'employees-template.xlsx'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('تعذر تنزيل القالب') }
  }

  async function upload() {
    if (!file || !branchId || busy) return
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 2 * 1024 * 1024) {
      setError('اختر ملف XLSX بحجم لا يتجاوز 2 ميجابايت'); return
    }
    setBusy(true); setError(''); setResult(null)
    const body = new FormData()
    body.append('file', file); body.append('branchId', branchId)
    try {
      const { data } = await api.post<Result>('/employees/import', body)
      setResult(data)
      setFile(null)
      onImported()
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'تعذر تأكيد نتيجة الاستيراد. راجع قائمة الموظفين قبل إعادة الرفع لتجنب التكرار.')
    } finally { setBusy(false) }
  }

  if (!allowed) return null
  return (
    <div className="mb-5">
      <button type="button" className="border border-blue-600 text-blue-700 rounded-lg px-4 py-2 text-sm" aria-expanded={open} onClick={() => setOpen(!open)}>استيراد الموظفين من Excel</button>
      {open ? <section aria-label="استيراد الموظفين" className="mt-3 rounded-xl border bg-white p-5 space-y-4">
        <h2 className="font-bold">رفع بيانات الموظفين</h2>
        <p className="text-sm text-gray-600">نزّل القالب واملأ جميع حقوله ثم اختر الفرع. المسمى الوظيفي والدرجة إلزاميان، ويجب أن يكون المسمى معرفًا مسبقًا في الهيكل التنظيمي. التواريخ ميلادية بصيغة YYYY-MM-DD. الحد الأقصى 500 موظف و2 ميجابايت.</p>
        <p className="text-sm text-gray-600">تُضاف الصفوف السليمة فقط ولا تُعدّل البيانات الموجودة. الرقم الوظيفي يولد تلقائياً. عند وجود أخطاء، أعد رفع الصفوف المرفوضة فقط. كلمات المرور تُضبط لاحقاً من ملف الموظف.</p>
        <button type="button" onClick={download} disabled={busy} className="text-blue-700 underline">تنزيل قالب Excel</button>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="text-sm">الفرع لجميع موظفي الملف
            <select value={branchId} disabled={busy} onChange={e => setBranchId(e.target.value)} className="block border rounded-lg p-2 mt-1" required>
              <option value="">اختر الفرع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-sm">ملف الموظفين (.xlsx)
            <input key={result ? 'completed' : 'ready'} type="file" accept=".xlsx" disabled={busy} className="block mt-1" onChange={e => { setFile(e.target.files?.[0] ?? null); setError('') }} />
          </label>
          <button type="button" disabled={busy || !file || !branchId} onClick={upload} className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-40">{busy ? 'جارٍ استيراد الموظفين…' : 'رفع وإضافة الموظفين'}</button>
        </div>
        {error ? <p role="alert" className="text-red-700 text-sm">{error}</p> : null}
        {result ? <div role="status" className="text-sm space-y-2">
          <p>تمت إضافة {result.imported} من {result.total} موظف. الصفوف المرفوضة: {result.rejected}.</p>
          {result.errors.length ? <div className="max-h-64 overflow-auto"><table className="w-full text-right"><thead><tr><th>صف Excel</th><th>سبب الرفض</th></tr></thead><tbody>{result.errors.map(e => <tr key={e.row}><td className="p-2">{e.row}</td><td>{e.message}</td></tr>)}</tbody></table></div> : null}
        </div> : null}
      </section> : null}
    </div>
  )
}
