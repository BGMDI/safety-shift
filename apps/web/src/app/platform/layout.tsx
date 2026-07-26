export const metadata = {
  title: 'لوحة مالك المنصة — نظام الشِّفتات',
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--ground)', minHeight: '100vh' }}>{children}</div>
}
