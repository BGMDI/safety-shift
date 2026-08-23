import { ShieldIcon, LogOutIcon, BuildingIcon } from '../icons';
import { Button, Tag, th, td } from '../ui/Primitives';
import { tenants, statusVariant } from '../data/sampleData';

export function PlatformDashboard({ adminName, onLogout, onEnter }) {
  return (
    <div>
      <nav className="flex items-center justify-between px-5 py-3 border-b-2 border-line">
        <span className="flex items-center gap-2 font-heading font-extrabold"><ShieldIcon size={18} />لوحة مالك المنصة</span>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-60">{adminName}</span>
          <Button variant="icon" aria-label="خروج" onClick={onLogout}><LogOutIcon size={16} /></Button>
        </div>
      </nav>
      <div className="px-6 py-8">
        <h1 className="text-3xl font-heading font-extrabold mb-1">الشركات</h1>
        <p className="opacity-60 mb-4">4 شركات على المنصة</p>
        <table className="w-full">
          <thead><tr><th className={th}>الشركة</th><th className={th}>الباقة</th><th className={th}>الحالة</th><th className={th}>الموظفون</th><th className={th}></th></tr></thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.name}>
                <td className={td}>{t.name}</td>
                <td className={td}><Tag variant={statusVariant(t.plan)}>{t.plan}</Tag></td>
                <td className={td}><Tag variant={statusVariant(t.status)}>{t.status}</Tag></td>
                <td className={`${td} opacity-60`}>{t.usersLabel}</td>
                <td className={td}><Button variant="secondary" onClick={() => onEnter(t.name)}><BuildingIcon size={14} />دخول كالشركة</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
