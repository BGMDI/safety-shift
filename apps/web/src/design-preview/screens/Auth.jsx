import { ShieldIcon } from '../icons';
import { Button, Field, inputClass, hr } from '../ui/Primitives';

export function CompanyLogin({ onSubmit, onGoPlatform }) {
  return (
    <div className="grid grid-cols-2 min-h-screen">
      <div className="text-white p-8 flex flex-col justify-between bg-accent">
        <div className="font-heading font-extrabold text-xl">Shift</div>
        <div>
          <h1 className="text-white text-4xl max-w-[14ch] mb-3">منصة واحدة لإدارة الموظفين والورديات والرواتب</h1>
          <p className="text-white/85 max-w-[34ch]">نظام متعدد المستأجرين — كل شركة بلوحتها ووحداتها المفعّلة.</p>
        </div>
        <div className="text-xs text-white/75">shift-saas · لوحة الشركة</div>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">
          <h2 className="text-2xl font-heading font-extrabold mb-1">تسجيل الدخول</h2>
          <p className="opacity-60 mb-4">لوحة الشركة</p>
          <Field label="البريد الإلكتروني" htmlFor="email">
            <input id="email" className={inputClass} defaultValue="mona.harbi@alofouq.sa" />
          </Field>
          <Field label="كلمة المرور" htmlFor="pass">
            <input id="pass" type="password" className={inputClass} defaultValue="********" />
          </Field>
          <Button variant="primary" block onClick={onSubmit}>تسجيل الدخول</Button>
          <div className={hr} />
          <Button variant="ghost" block onClick={onGoPlatform}>الدخول كمالك المنصة</Button>
        </div>
      </div>
    </div>
  );
}

export function PlatformLogin({ onSubmit, onBack }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-2 mb-1">
          <ShieldIcon size={20} />
          <h2 className="text-2xl font-heading font-extrabold">لوحة مالك المنصة</h2>
        </div>
        <p className="opacity-60 mb-4">دخول منفصل تماماً عن حسابات الشركات</p>
        <Field label="البريد الإلكتروني" htmlFor="padmin">
          <input id="padmin" className={inputClass} defaultValue="abdullah@platform-owner.sa" />
        </Field>
        <Field label="كلمة المرور" htmlFor="ppass">
          <input id="ppass" type="password" className={inputClass} defaultValue="********" />
        </Field>
        <Button variant="primary" block onClick={onSubmit}>دخول</Button>
        <div className={hr} />
        <Button variant="ghost" block onClick={onBack}>رجوع لتسجيل دخول الشركة</Button>
      </div>
    </div>
  );
}
