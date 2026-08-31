'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './BottomNav.module.css'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { href: '/alunos', label: 'Alunos', icon: '👥' },
  { href: '/mensagens', label: 'Msgs', icon: '💬' },
  { href: '/historico', label: 'Histórico', icon: '📋' },
  { href: '/configuracoes', label: 'Config.', icon: '⚙️' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.bottomNav} aria-label="Navegação móvel">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
