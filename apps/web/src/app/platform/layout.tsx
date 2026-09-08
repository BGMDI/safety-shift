import { PlatformShell } from '../../components/layout/platform-shell'

export const metadata = {
  title: 'لوحة مالك المنصة — نظام وردية',
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>
}
