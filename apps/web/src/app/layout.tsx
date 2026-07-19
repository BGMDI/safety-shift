import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'نظام إدارة الشفتات',
  description: 'منصة متكاملة لإدارة الشفتات والموارد البشرية',
}

// يمنع "وميض" الثيم الخاطئ قبل تحميل React — يُنفَّذ فوراً قبل الرسم الأول
const themeInit = `
(function () {
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
