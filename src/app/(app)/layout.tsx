import type { ReactNode } from 'react'
import { BottomNav } from '@/components/nav/bottom-nav'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pb-16">
      {children}
      <BottomNav />
    </div>
  )
}
