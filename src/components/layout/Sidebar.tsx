'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './Sidebar.module.css'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { href: '/alunos', label: 'Alunos', icon: '👥' },
  { href: '/mensagens', label: 'Mensagens', icon: '💬' },
  { href: '/historico', label: 'Histórico', icon: '📋' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="52" cy="62" rx="28" ry="20" fill="#fff"/>
          <ellipse cx="25" cy="52" rx="16" ry="13" fill="#fff"/>
          <polygon points="14,42 20,28 24,42" fill="#fff"/>
          <polygon points="20,42 24,35 27,42" fill="#fff"/>
          <rect x="36" y="46" width="12" height="14" rx="4" fill="#fff"/>
          <ellipse cx="29" cy="40" rx="4" ry="5" fill="#fff"/>
          <circle cx="19" cy="50" r="2.5" fill="#0a0a0a"/>
          <rect x="30" y="78" width="8" height="14" rx="3" fill="#fff"/>
          <rect x="44" y="78" width="8" height="14" rx="3" fill="#fff"/>
          <rect x="58" y="78" width="8" height="14" rx="3" fill="#fff"/>
          <rect x="68" y="78" width="8" height="13" rx="3" fill="#fff"/>
          <path d="M78 58 Q90 50 88 65" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none"/>
        </svg>
        <span className={styles.brandName}>RF Team</span>
      </div>

      <nav className={styles.nav} aria-label="Navegação principal">
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
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className={styles.footer}>
        <button
          onClick={handleLogout}
          className={styles.logoutBtn}
          id="sidebar-logout-btn"
        >
          <span>↪</span>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}
