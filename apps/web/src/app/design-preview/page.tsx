'use client'

// معاينة نظام التصميم الجديد — نموذج أوّلي ببيانات وهمية، معزول تماماً عن التطبيق الفعلي.
// لا يستدعي أي API ولا يقرأ توكن الدخول، ولا يؤثر على أي صفحة قائمة.
import './preview.css'
import App from '../../design-preview/App.jsx'

export default function DesignPreviewPage() {
  return (
    <div className="design-preview-root">
      <App />
    </div>
  )
}
