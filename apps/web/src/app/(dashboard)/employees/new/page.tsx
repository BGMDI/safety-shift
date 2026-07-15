'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { api } from '../../../../lib/api'
import { useAuth } from '../../../../hooks/useAuth'

const PRESET_PREFIXES = [
  { label: 'موظف',   value: 'EMP' },
  { label: 'مدير',   value: 'MGR' },
  { label: 'مشرف',  value: 'SUP' },
  { label: 'حارس',  value: 'GRD' },
  { label: 'فني',   value: 'TEC' },
]

const schema = z.object({
  firstName:        z.string().min(1, 'الاسم الأول مطلوب'),
  fatherName:       z.string().optional(),
  grandfatherName:  z.string().optional(),
  familyName:       z.string().optional(),
  branchId:         z.string().min(1, 'اختر الفرع'),
  departmentId: z.string().optional(),
  jobTitleId:   z.string().optional(),
  hireDate:     z.string().min(1, 'مطلوب'),
  email:        z.string().email('بريد غير صالح').optional().or(z.literal('')),
  phone:        z.string().optional(),
  nationalId:   z.string().optional(),
  password:     z.string().min(8, '8 أحرف على الأقل').optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export default function NewEmployeePage() {
  useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [prefix, setPrefix] = useState('EMP')
  const [customPrefix, setCustomPrefix] = useState('')
  const [previewCode, setPreviewCode] = useState('...')
  const [loadingCode, setLoadingCode] = useState(false)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [jobTitles, setJobTitles] = useState<{ id: string; name: string }[]>([])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const activePrefix = customPrefix.trim().toUpperCase() || prefix

  const fetchNextCode = useCallback(async (p: string) => {
    if (!p) return
    setLoadingCode(true)
    try {
      const res = await api.get(`/employees/next-code?prefix=${p.toUpperCase()}`)
      setPreviewCode(res.data.code)
    } catch {
      setPreviewCode(`${p.toUpperCase()}0001`)
    } finally {
      setLoadingCode(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      api.get('/branches').catch(() => ({ data: [] })),
      api.get('/departments').catch(() => ({ data: [] })),
      api.get('/job-titles').catch(() => ({ data: [] })),
    ]).then(([b, d, j]) => {
      setBranches(b.data)
      setDepartments(d.data)
      setJobTitles(j.data)
    })
    fetchNextCode('EMP')
  }, [fetchNextCode])

  useEffect(() => {
    const timer = setTimeout(() => fetchNextCode(activePrefix), 400)
    return () => clearTimeout(timer)
  }, [activePrefix, fetchNextCode])

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      await api.post('/employees', {
        ...data,
        codePrefix:   activePrefix,
        email:        data.email        || undefined,
        password:     data.password     || undefined,
        departmentId: data.departmentId || undefined,
        jobTitleId:   data.jobTitleId   || undefined,
        fatherName:       data.fatherName       || undefined,
        grandfatherName:  data.grandfatherName  || undefined,
        familyName:       data.familyName       || undefined,
      })
      router.push('/employees')
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'حدث خطأ، حاول مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/employees" className="text-gray-400 hover:text-gray-600 text-sm">← الموظفون</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold">إضافة موظف جديد</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-6 space-y-5">

        {/* حقل البادئة + معاينة الكود */}
        <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">كود الموظف</p>

          {/* أزرار البادئات المحددة مسبقاً */}
          <div className="flex flex-wrap gap-2">
            {PRESET_PREFIXES.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => { setPrefix(p.value); setCustomPrefix('') }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  activePrefix === p.value && !customPrefix
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {p.label} ({p.value})
              </button>
            ))}
          </div>

          {/* بادئة مخصصة */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">أو اكتب بادئة مخصصة</label>
              <input
                type="text"
                maxLength={5}
                placeholder="مثال: DRV للسائقين"
                value={customPrefix}
                onChange={e => setCustomPrefix(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
              />
            </div>

            {/* معاينة الكود */}
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">الكود الذي سيُولَّد</p>
              <div className="bg-white border-2 border-blue-200 rounded-lg px-4 py-2 min-w-28">
                {loadingCode
                  ? <span className="text-gray-400 text-sm">...</span>
                  : <span className="font-mono font-bold text-blue-700 text-lg">{previewCode}</span>
                }
              </div>
            </div>
          </div>
        </div>

        {/* الاسم الرباعي */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">الاسم *</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="الاسم الأول *" error={errors.firstName?.message}>
              <input {...register('firstName')} placeholder="محمد" className={input} />
            </Field>
            <Field label="اسم الأب" error={errors.fatherName?.message}>
              <input {...register('fatherName')} placeholder="علي" className={input} />
            </Field>
            <Field label="اسم الجد" error={errors.grandfatherName?.message}>
              <input {...register('grandfatherName')} placeholder="سالم" className={input} />
            </Field>
            <Field label="اللقب" error={errors.familyName?.message}>
              <input {...register('familyName')} placeholder="العمري" className={input} />
            </Field>
          </div>
        </div>

        {/* تاريخ التعيين */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="تاريخ التعيين *" error={errors.hireDate?.message}>
            <input {...register('hireDate')} type="date" className={input} />
          </Field>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="الفرع *" error={errors.branchId?.message}>
            <select {...register('branchId')} className={input}>
              <option value="">اختر الفرع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="القسم" error={errors.departmentId?.message}>
            <select {...register('departmentId')} className={input}>
              <option value="">بدون قسم</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="الوظيفة" error={errors.jobTitleId?.message}>
            <select {...register('jobTitleId')} className={input}>
              <option value="">بدون وظيفة</option>
              {jobTitles.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </Field>
        </div>

        <hr className="border-gray-100" />

        {/* Row 4 */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="البريد الإلكتروني" error={errors.email?.message}>
            <input {...register('email')} type="email" placeholder="emp@company.com" className={input} />
          </Field>
          <Field label="رقم الجوال" error={errors.phone?.message}>
            <input {...register('phone')} placeholder="05XXXXXXXX" className={input} />
          </Field>
        </div>

        {/* Row 5 */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="رقم الهوية" error={errors.nationalId?.message}>
            <input {...register('nationalId')} placeholder="1XXXXXXXXX" className={input} />
          </Field>
          <Field label="كلمة المرور للنظام" error={errors.password?.message}>
            <input {...register('password')} type="password" placeholder="8 أحرف على الأقل" className={input} />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
          >
            {loading ? 'جاري الحفظ...' : `حفظ الموظف (${previewCode})`}
          </button>
          <Link href="/employees" className="px-6 py-2.5 rounded-lg border hover:bg-gray-50 transition text-sm">
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  )
}

const input = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
