'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, LogIn, Search, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { platformApi } from '../../../lib/platform-api'

interface AuditEntry {
  id: string
  action: string
  tenantId: string | null
  tenantName: string | null
  entityId: string | null
  createdAt: string
  details: {
    platformOwnerName?: string
    platformOwnerEmail?: string
    targetUserName?: string
    targetUserEmail?: string
  } | null
}

export default function PlatformAuditPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('platform_access_token')) { router.replace('/platform/login'); return }
    platformApi.get('/platform/audit').then(({ data }) => setEntries(data)).catch(() => setEntries([])).finally(() => setLoading(false))
  }, [router])

  const visible = useMemo(() => {
    const value = query.trim().toLocaleLowerCase('ar')
    if (!value) return entries
    return entries.filter(entry => [entry.tenantName, entry.details?.platformOwnerName, entry.details?.platformOwnerEmail, entry.details?.targetUserName, entry.details?.targetUserEmail].some(item => item?.toLocaleLowerCase('ar').includes(value)))
  }, [entries, query])

  const companyLogins = entries.filter(entry => entry.action === 'TENANT_IMPERSONATE').length
  const ownerLogins = entries.filter(entry => entry.action === 'PLATFORM_LOGIN').length

  return <div className="platform-page">
    <header className="platform-page-head"><div><p>الأمان والشفافية</p><h1>سجل تدقيق مالك المنصة</h1><span>جميع عمليات الدخول إلى لوحة المالك وحسابات الشركات، مرتبة من الأحدث.</span></div></header>

    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <Stat icon={<FileIcon />} label="إجمالي الحركات" value={entries.length} />
      <Stat icon={<ShieldCheck size={20} />} label="دخول لوحة المالك" value={ownerLogins} />
      <Stat icon={<Building2 size={20} />} label="دخول حسابات الشركات" value={companyLogins} />
    </section>

    <section className="platform-card overflow-hidden">
      <div className="p-4 border-b" style={{ borderColor: 'var(--line)' }}><label className="relative block max-w-md"><Search size={17} className="absolute right-3 top-3" style={{ color: 'var(--ink-3)' }} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث باسم الشركة أو المستخدم أو البريد" className="w-full rounded-xl py-2.5 pr-10 pl-3 text-sm outline-none" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }} /></label></div>
      {loading ? <p className="p-8 text-center" style={{ color: 'var(--ink-3)' }}>جارٍ تحميل السجل…</p> : visible.length === 0 ? <p className="p-8 text-center" style={{ color: 'var(--ink-3)' }}>لا توجد حركات مطابقة</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['الحركة', 'مالك المنصة', 'الشركة', 'المستخدم المستهدف', 'التاريخ والوقت'].map(label => <th key={label} className="p-4 text-right">{label}</th>)}</tr></thead><tbody>{visible.map(entry => {
        const login = entry.action === 'PLATFORM_LOGIN'
        return <tr key={entry.id} className="border-t" style={{ borderColor: 'var(--line)' }}><td className="p-4"><span className="inline-flex items-center gap-2 font-bold">{login ? <LogIn size={17} /> : <UserRoundCheck size={17} />}{login ? 'دخول لوحة المالك' : entry.action === 'TENANT_IMPERSONATE' ? 'دخول إلى شركة' : entry.action}</span></td><td className="p-4"><strong className="block">{entry.details?.platformOwnerName ?? '—'}</strong><small style={{ color: 'var(--ink-3)' }}>{entry.details?.platformOwnerEmail ?? ''}</small></td><td className="p-4">{entry.tenantName ?? 'لوحة المالك'}</td><td className="p-4"><strong className="block">{entry.details?.targetUserName ?? (login ? entry.details?.platformOwnerName : '—')}</strong><small style={{ color: 'var(--ink-3)' }}>{entry.details?.targetUserEmail ?? ''}</small></td><td className="p-4 whitespace-nowrap"><strong>{new Date(entry.createdAt).toLocaleDateString('ar-SA')}</strong><small className="block mt-1" style={{ color: 'var(--ink-3)' }}>{new Date(entry.createdAt).toLocaleTimeString('ar-SA')}</small></td></tr>
      })}</tbody></table></div>}
    </section>
  </div>
}

function FileIcon() { return <LogIn size={20} /> }
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <article className="platform-card p-4"><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>{icon}</span><div><strong className="block text-xl">{value.toLocaleString('ar-SA')}</strong><span className="text-xs" style={{ color: 'var(--ink-3)' }}>{label}</span></div></div></article>
}
