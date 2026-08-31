'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError('E-mail ou senha incorretos. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Logo */}
        <div className={styles.brand}>
          <div className={styles.logoWrap}>
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
          </div>
          <h1 className={styles.brandName}>RF Team</h1>
          <p className={styles.brandTagline}>Academia de Jiu-Jitsu</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className={styles.form} id="login-form">
          <h2 className={styles.formTitle}>Entrar</h2>

          {error && (
            <div className={styles.errorAlert} role="alert">
              <span>⚠</span> {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="login-email" className="form-label">E-mail</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className="form-input"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Senha</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            id="login-submit-btn"
            className="btn btn-primary btn-lg btn-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner spinner-sm" />
                Entrando…
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p className={styles.footer}>
          RF Team 🦏 — Força e disciplina no tatame
        </p>
      </div>
    </div>
  )
}
