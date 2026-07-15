'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function JobTitlesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/departments?tab=jobs') }, [router])
  return null
}
