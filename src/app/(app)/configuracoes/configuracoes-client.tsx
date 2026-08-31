'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Academy, Profile } from '@/types'

interface Props {
  academy: Academy | null
  profile: Profile | null
  userEmail: string
}

export default function ConfiguracoesClient({ academy, profile, userEmail }: Props) {
  const router = useRouter()
  const [name, setName] = useState(academy?.name || 'RF Team Jiu-Jitsu')
  const [pixKey, setPixKey] = useState(academy?.pix_key || '')
  const [timezone, setTimezone] = useState(academy?.timezone || 'America/Fortaleza')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pix_key: pixKey, timezone }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error || 'Erro ao salvar configurações.' })
        return
      }

      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' })
      router.refresh()
    } catch {
      setMessage({ type: 'error', text: 'Erro de conexão.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Configurações
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Gerencie as informações da academia e a chave Pix para cobrança.
        </p>
      </div>

      {message && (
        <div
          className={`badge ${message.type === 'success' ? 'badge-success' : 'badge-danger'}`}
          style={{ padding: '10px 14px', fontSize: '14px', marginBottom: 'var(--space-6)' }}
        >
          {message.text}
        </div>
      )}

      <div className="card" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} id="settings-form" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="form-group">
            <label htmlFor="settings-name" className="form-label">
              Nome da Academia <span className="required">*</span>
            </label>
            <input
              id="settings-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="settings-pix" className="form-label">
              Chave Pix para mensalidades
            </label>
            <input
              id="settings-pix"
              type="text"
              className="form-input"
              placeholder="CNPJ, E-mail, Telefone ou Chave Aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              disabled={loading}
            />
            <span className="form-hint">
              Esta chave será incluída automaticamente em todas as mensagens enviadas aos alunos.
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="settings-tz" className="form-label">Fuso Horário</label>
            <select
              id="settings-tz"
              className="form-select"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={loading}
            >
              <option value="America/Fortaleza">America/Fortaleza (UTC-3)</option>
              <option value="America/Sao_Paulo">America/Sao_Paulo (UTC-3)</option>
              <option value="America/Recife">America/Recife (UTC-3)</option>
              <option value="America/Manaus">America/Manaus (UTC-4)</option>
              <option value="America/Belem">America/Belem (UTC-3)</option>
            </select>
            <span className="form-hint">Usado para calcular a virada do dia de vencimento sem erros.</span>
          </div>

          <div className="divider" />

          {/* Status da integração WhatsApp */}
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Status da Automação de WhatsApp
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="badge badge-success">Camada 1 Ativa (Lembrete 1-toque)</span>
            </div>
            <p className="form-hint" style={{ marginTop: 'var(--space-2)' }}>
              Disparo com 1 toque via WhatsApp Web/App. Zero custo, zero risco de bloqueio.
            </p>
          </div>

          <div className="divider" />

          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Conta logada: <strong>{userEmail}</strong>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            id="settings-save-btn"
          >
            {loading ? <span className="spinner spinner-sm" /> : 'Salvar configurações'}
          </button>
        </form>
      </div>
    </div>
  )
}
