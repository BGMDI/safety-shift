'use client'
import { useAuth } from '../../../hooks/useAuth'

export default function SettingsPage() {
  useAuth()
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">الإعدادات</h1>
      <div className="space-y-4">
        {[
          { icon: '🏢', label: 'بيانات الشركة', desc: 'اسم الشركة، الشعار، الفروع' },
          { icon: '🔔', label: 'الإشعارات', desc: 'إعدادات البريد الإلكتروني والإشعارات' },
          { icon: '👥', label: 'الصلاحيات', desc: 'إدارة الأدوار والصلاحيات' },
          { icon: '💳', label: 'الاشتراك', desc: 'إدارة خطة الاشتراك والدفع' },
          { icon: '🔒', label: 'الأمان', desc: 'كلمة المرور والمصادقة الثنائية' },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="font-semibold">{item.label}</p>
              <p className="text-gray-500 text-sm">{item.desc}</p>
            </div>
            <span className="mr-auto text-gray-400">›</span>
          </div>
        ))}
      </div>
    </div>
  )
}
