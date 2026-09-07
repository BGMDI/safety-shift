import type { Metadata } from 'next'
import { Inter, Tajawal } from 'next/font/google'
import './globals.css'

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-arabic',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-latin',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'نظام وردية', template: '%s | نظام وردية' },
  description: 'إدارة أسهل، ورديات أذكى',
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
      <body className={`${tajawal.variable} ${inter.variable}`}>{children}</body>
    </html>
  )
}
