'use client'
import { useEffect, useState } from 'react'

export function ThemeToggle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme')
    const isDark = current ? current === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(isDark)
  }, [])

  const toggle = () => {
    const next = dark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    setDark(!dark)
  }

  return (
    <button onClick={toggle} aria-label="تبديل الوضع الليلي"
      className={className ?? 'w-9 h-9 rounded-lg border flex items-center justify-center transition'}
      style={style ?? { borderColor: 'var(--line)', background: 'var(--surface)', color: 'var(--ink-2)' }}>
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
          <path d="M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5 19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5 19 5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>
        </svg>
      )}
    </button>
  )
}
