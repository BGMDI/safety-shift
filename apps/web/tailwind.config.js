/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/design-preview/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // ── رموز نظام التصميم Modernist — تستخدمها معاينة التصميم في /design-preview ──
      // إضافية بالكامل: التطبيق القائم لا يستخدم neutral-* ولا accent-* فلا تعارض.
      colors: {
        bg: '#f3f2f2',
        surface: '#eae9e9',
        ink: '#201e1d',
        line: 'rgba(32,30,29,0.4)',
        accent: {
          DEFAULT: '#ec3013',
          100: '#fff2ef', 200: '#ffe0d9', 300: '#ffc4b8', 400: '#ff9783', 500: '#ff563c',
          600: '#dd2b0f', 700: '#ae1800', 800: '#7c1405', 900: '#4d170e',
        },
        neutral: {
          100: '#f8f4f4', 200: '#eae7e7', 300: '#d7d3d3', 400: '#bab6b6', 500: '#9b9797',
          600: '#7d7979', 700: '#605d5d', 800: '#444141', 900: '#2d2b2b',
        },
      },
      fontFamily: {
        heading: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['Archivo', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(45,43,43,.14)',
        md: '0 3px 10px rgba(45,43,43,.16)',
        lg: '0 12px 32px rgba(45,43,43,.22)',
      },
    },
  },
  plugins: [],
}
