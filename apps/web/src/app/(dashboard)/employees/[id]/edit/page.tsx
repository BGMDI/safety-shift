'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'

interface SelectOption { id: string; name: string }
interface EmployeeData {
  id: string; fullName: string
  firstName: string | null; fatherName: string | null
  grandfatherName: string | null; familyName: string | null
  email: string | null; phone: string | null
  nationalId: string | null; idExpiryDate: string | null; nationality: string | null
  birthDate: string | null; qualification: string | null; specialization: string | null
  iban: string | null; photo: string | null
  status: string; hireDate: string; employeeCode: string
  branch: { id: string; name: string } | null
  department: { id: string; name: string } | null
  jobTitle: { id: string; name: string } | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const inp = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

const NATIONALITIES = [
  'سعودي', 'مصري', 'سوداني', 'يمني', 'سوري', 'أردني', 'فلسطيني', 'لبناني',
  'عراقي', 'مغربي', 'تونسي', 'جزائري', 'ليبي', 'موريتاني',
  'كويتي', 'إماراتي', 'قطري', 'بحريني', 'عُماني',
  'هندي', 'باكستاني', 'بنغالي', 'سريلانكي', 'نيبالي',
  'فلبيني', 'إندونيسي', 'تايلاندي',
  'أمريكي', 'بريطاني', 'فرنسي', 'كندي', 'أسترالي', 'ألماني', 'تركي', 'إيراني',
]

const QUALIFICATIONS = [
  'بدون مؤهل', 'ابتدائي', 'متوسط', 'ثانوي',
  'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه',
  'دبلوم عالي', 'زمالة مهنية',
]

/** يجمع أجزاء الاسم */
function buildFullName(f: { firstName: string; fatherName: string; grandfatherName: string; familyName: string }) {
  return [f.firstName, f.fatherName, f.grandfatherName, f.familyName].map(p => p.trim()).filter(Boolean).join(' ')
}

/** احتساب العمر بالسنوات من تاريخ الميلاد */
function calcAge(birthDateStr: string): number | null {
  if (!birthDateStr) return null
  const birth = new Date(birthDateStr)
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age >= 0 ? age : null
}

function validateIBAN(iban: string): string | null {
  if (!iban) return null
  const clean = iban.replace(/\s/g, '').toUpperCase()
  if (!/^SA\d{22}$/.test(clean)) return 'IBAN غير صحيح — الصيغة: SA ثم 22 رقماً (مجموع 24 حرف)'
  return null
}

export default function EditEmployeePage() {
  const params = useParams<{ id: string }>()
  useAuth()
  const { id } = params
  const router  = useRouter()

  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')
  const [uploadingPhoto, setUploading] = useState(false)

  const [branches, setBranches]       = useState<SelectOption[]>([])
  const [departments, setDepartments] = useState<SelectOption[]>([])
  const [jobTitles, setJobTitles]     = useState<SelectOption[]>([])
  const [currentPhoto, setPhoto]      = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    firstName: '', fatherName: '', grandfatherName: '', familyName: '',
    email: '', phone: '', nationalId: '',
    idExpiryDate: '', nationality: '',
    birthDate: '', qualification: '', specialization: '', iban: '',
    hireDate: '', branchId: '', departmentId: '', jobTitleId: '',
    status: 'ACTIVE', password: '',
  })

  useEffect(() => {
    Promise.all([
      api.get(`/employees/${id}`),
      api.get('/branches').catch(() => ({ data: [] })),
      api.get('/departments').catch(() => ({ data: [] })),
      api.get('/job-titles').catch(() => ({ data: [] })),
    ]).then(([emp, b, d, j]) => {
      const e: EmployeeData = emp.data
      setPhoto(e.photo)
      setForm({
        firstName:       e.firstName       ?? '',
        fatherName:      e.fatherName      ?? '',
        grandfatherName: e.grandfatherName ?? '',
        familyName:      e.familyName      ?? '',
        email:        e.email        ?? '',
        phone:        e.phone        ?? '',
        nationalId:   e.nationalId   ?? '',
        idExpiryDate: e.idExpiryDate ? e.idExpiryDate.split('T')[0] : '',
        nationality:  e.nationality  ?? '',
        birthDate:    e.birthDate    ? e.birthDate.split('T')[0] : '',
        qualification: e.qualification ?? '',
        specialization: e.specialization ?? '',
        iban:         e.iban         ?? '',
        hireDate:     e.hireDate     ? e.hireDate.split('T')[0] : '',
        branchId:     e.branch?.id   ?? '',
        departmentId: e.department?.id ?? '',
        jobTitleId:   e.jobTitle?.id   ?? '',
        status:       e.status,
        password:     '',
      })
      setBranches(b.data); setDepartments(d.data); setJobTitles(j.data)
    }).catch(() => router.push('/employees'))
      .finally(() => setLoading(false))
  }, [id, router])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  /* ── رفع الصورة ── */
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('حجم الصورة لا يتجاوز 5 MB'); return }
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('photo', file)
      const res = await api.post(`/employees/${id}/photo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPhoto(res.data.photo)
    } catch (err: any) { alert(err.response?.data?.message ?? 'فشل رفع الصورة') }
    finally { setUploading(false) }
  }

  /* ── حفظ البيانات ── */
  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const ibanErr = validateIBAN(form.iban)
    if (ibanErr) { setError(ibanErr); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.put(`/employees/${id}`, {
        firstName:        form.firstName        || undefined,
        fatherName:       form.fatherName       || undefined,
        grandfatherName:  form.grandfatherName  || undefined,
        familyName:       form.familyName       || undefined,
        email:        form.email        || undefined,
        phone:        form.phone        || undefined,
        nationalId:   form.nationalId   || undefined,
        idExpiryDate:  form.idExpiryDate  || undefined,
        nationality:   form.nationality   || undefined,
        birthDate:     form.birthDate     || undefined,
        qualification: form.qualification || undefined,
        specialization: form.specialization || undefined,
        iban:          form.iban.replace(/\s/g, '') || undefined,
        hireDate:     form.hireDate     || undefined,
        branchId:     form.branchId     || undefined,
        departmentId: form.departmentId || undefined,
        jobTitleId:   form.jobTitleId   || undefined,
        status:       form.status,
        password:     form.password     || undefined,
      })
      setSuccess('تم حفظ التعديلات بنجاح ✅')
      setTimeout(() => router.push('/employees'), 1200)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'حدث خطأ')
    } finally { setSaving(false) }
  }

  /* ── حسابات ── */
  const ibanError = form.iban ? validateIBAN(form.iban) : null
  const idExpiry  = form.idExpiryDate ? new Date(form.idExpiryDate) : null
  const daysLeft  = idExpiry ? Math.ceil((idExpiry.getTime() - Date.now()) / 86400000) : null
  const idExpired = daysLeft !== null && daysLeft <= 0
  const idSoon    = daysLeft !== null && daysLeft > 0 && daysLeft <= 30
  const age       = form.birthDate ? calcAge(form.birthDate) : null

  if (loading) return <div className="p-6 text-gray-400 text-center">جارٍ التحميل...</div>

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
        <Link href="/employees" className="hover:text-gray-600">الموظفون</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">تعديل</span>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">

        {/* ══ الصورة الشخصية ══ */}
        <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200 border-4 border-white shadow-lg">
              {currentPhoto
                ? <img src={`${API_URL}${currentPhoto}`} alt="صورة الموظف" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-blue-500 text-3xl font-bold">
                    {buildFullName(form).charAt(0) || '؟'}
                  </div>
              }
            </div>
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">⏳</span>
              </div>
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-800">
              {buildFullName(form) || 'الموظف'}
              {age !== null && (
                <span className="mr-2 text-sm font-normal text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                  {age} سنة
                </span>
              )}
            </h1>
            <p className="text-gray-400 text-xs mb-3">الصورة الشخصية</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}
                className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                📷 {uploadingPhoto ? 'جارٍ الرفع...' : currentPhoto ? 'تغيير الصورة' : 'رفع صورة'}
              </button>
              {currentPhoto && (
                <button type="button" onClick={async () => {
                  await api.put(`/employees/${id}`, { photo: null as any }); setPhoto(null)
                }} className="text-red-500 text-xs px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50">
                  🗑 حذف
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" onChange={handlePhoto} />
            <p className="text-xs text-gray-400 mt-1.5">JPG · PNG · WebP — حد أقصى 5 MB</p>
          </div>
        </div>

        {/* ══ البيانات الأساسية ══ */}
        <Section title="البيانات الأساسية">
          {/* الاسم الرباعي */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            <Field label="الاسم الأول *">
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                required className={inp} placeholder="محمد" />
            </Field>
            <Field label="اسم الأب">
              <input value={form.fatherName} onChange={e => set('fatherName', e.target.value)}
                className={inp} placeholder="علي" />
            </Field>
            <Field label="اسم الجد">
              <input value={form.grandfatherName} onChange={e => set('grandfatherName', e.target.value)}
                className={inp} placeholder="سالم" />
            </Field>
            <Field label="اللقب">
              <input value={form.familyName} onChange={e => set('familyName', e.target.value)}
                className={inp} placeholder="العمري" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="الحالة الوظيفية">
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
                <option value="ACTIVE">نشط</option>
                <option value="SUSPENDED">موقوف</option>
                <option value="TERMINATED">منتهي الخدمة</option>
              </select>
            </Field>
            <Field label="تاريخ التعيين">
              <input type="date" value={form.hireDate} onChange={e => set('hireDate', e.target.value)} className={inp} />
            </Field>
            <Field label="الجنسية">
              <select value={form.nationality} onChange={e => set('nationality', e.target.value)} className={inp}>
                <option value="">-- اختر الجنسية --</option>
                {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>

            {/* تاريخ الميلاد + العمر */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                تاريخ الميلاد
                {age !== null && (
                  <span className="mr-2 text-blue-600 font-semibold">{age} سنة</span>
                )}
              </label>
              <input
                type="date"
                value={form.birthDate}
                onChange={e => set('birthDate', e.target.value)}
                className={inp}
              />
            </div>

            <Field label="المؤهل الدراسي">
              <select value={form.qualification} onChange={e => set('qualification', e.target.value)} className={inp}>
                <option value="">-- اختر المؤهل --</option>
                {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>

            <Field label="التخصص">
              <input
                value={form.specialization}
                onChange={e => set('specialization', e.target.value)}
                className={inp}
                placeholder="مثال: علوم الحاسب، إدارة الأعمال، المحاسبة..."
              />
            </Field>
          </div>
        </Section>

        {/* ══ بيانات الهوية ══ */}
        <Section title="بيانات الهوية">
          <div className="grid grid-cols-2 gap-4">
            <Field label="رقم الهوية / الإقامة">
              <input value={form.nationalId} onChange={e => set('nationalId', e.target.value)}
                className={inp} placeholder="1XXXXXXXXX" />
            </Field>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                تاريخ انتهاء الهوية
                {idExpired && <span className="text-red-500 mr-2 font-bold">● منتهية!</span>}
                {idSoon    && <span className="text-yellow-600 mr-2">● تنتهي خلال {daysLeft} يوم</span>}
              </label>
              <input type="date" value={form.idExpiryDate}
                onChange={e => set('idExpiryDate', e.target.value)}
                className={`${inp} ${idExpired ? 'border-red-400 bg-red-50 focus:ring-red-400' : idSoon ? 'border-yellow-400 bg-yellow-50 focus:ring-yellow-400' : ''}`} />
            </div>
          </div>
        </Section>

        {/* ══ IBAN ══ */}
        <Section title="بيانات الراتب البنكي">
          <Field label="رقم الحساب البنكي IBAN">
            <div className="relative">
              <input
                value={form.iban}
                onChange={e => set('iban', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                className={`${inp} font-mono text-base tracking-widest pr-8 ${
                  ibanError ? 'border-red-400 focus:ring-red-400' :
                  (form.iban && !ibanError) ? 'border-green-400 focus:ring-green-400' : ''
                }`}
                placeholder="SA0380000000608010167519"
                maxLength={24}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                {form.iban && !ibanError ? '✅' : form.iban ? '❌' : ''}
              </span>
            </div>
            {ibanError
              ? <p className="text-red-500 text-xs mt-1">{ibanError}</p>
              : form.iban && <p className="text-green-600 text-xs mt-1">✅ IBAN صحيح ({form.iban.length}/24 حرف)</p>}
            <p className="text-gray-400 text-xs mt-1">SA + 22 رقماً — مثال: SA0380000000608010167519</p>
          </Field>
        </Section>

        {/* ══ الهيكل التنظيمي ══ */}
        <Section title="الهيكل التنظيمي">
          <div className="grid grid-cols-3 gap-4">
            <Field label="الفرع">
              <select value={form.branchId} onChange={e => set('branchId', e.target.value)} className={inp}>
                <option value="">-- الفرع --</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="القسم">
              <select value={form.departmentId} onChange={e => set('departmentId', e.target.value)} className={inp}>
                <option value="">بدون قسم</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="الوظيفة">
              <select value={form.jobTitleId} onChange={e => set('jobTitleId', e.target.value)} className={inp}>
                <option value="">بدون وظيفة</option>
                {jobTitles.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        {/* ══ بيانات التواصل ══ */}
        <Section title="بيانات التواصل">
          <div className="grid grid-cols-2 gap-4">
            <Field label="البريد الإلكتروني">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className={inp} placeholder="emp@company.com" />
            </Field>
            <Field label="رقم الجوال">
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className={inp} placeholder="05XXXXXXXX" />
            </Field>
          </div>
        </Section>

        {/* ══ كلمة المرور ══ */}
        <Section title="كلمة المرور">
          <Field label="كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)">
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
              className={inp} placeholder="8 أحرف على الأقل" />
          </Field>
          {form.password && form.password.length < 8 && (
            <p className="text-orange-500 text-xs mt-1">كلمة المرور يجب أن تكون 8 أحرف على الأقل</p>
          )}
        </Section>

        {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit"
            disabled={saving || (!!form.password && form.password.length < 8) || !!ibanError}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium">
            {saving ? 'جارٍ الحفظ...' : '💾 حفظ التعديلات'}
          </button>
          <Link href="/employees"
            className="px-6 py-2.5 rounded-lg border hover:bg-gray-50 transition text-sm text-center">
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">{title}</h2>
      {children}
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
