'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Dumbbell, TrendingUp, Utensils, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/rutina', label: 'Rutina', icon: Dumbbell },
  { href: '/progreso', label: 'Progreso', icon: TrendingUp },
  { href: '/macros', label: 'Macros', icon: Utensils },
  { href: '/perfil', label: 'Perfil', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background">
      <ul className="flex justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2 text-xs ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
