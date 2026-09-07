import { Sidebar } from '../../components/layout/sidebar'
import { RouteGuard } from '../../components/layout/route-guard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell flex min-h-screen">
      <Sidebar />
      <main className="app-main flex-1 min-w-0 overflow-auto">
        <RouteGuard>{children}</RouteGuard>
      </main>
    </div>
  )
}
