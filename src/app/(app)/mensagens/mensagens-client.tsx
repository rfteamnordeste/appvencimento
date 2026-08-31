'use client'

import { useState } from 'react'
import type { ReminderType, Academy } from '@/types'
import { DEFAULT_TEMPLATES } from '@/lib/billing'
import { buildMessage } from '@/lib/messaging'
import styles from './mensagens.module.css'

interface Props {
  initialTemplates: Record<ReminderType, { content: string; active: boolean }>
  academy: Academy
}

const templateInfo: Record<ReminderType, { title: string; desc: string }> = {
  d10: { title: 'Lembrete D-10', desc: 'Enviado 10 dias antes do vencimento' },
  d5: { title: 'Lembrete D-5', desc: 'Enviado 5 dias antes do vencimento' },
  d0: { title: 'Lembrete D-0 (Vencimento)', desc: 'Enviado no dia do vencimento' },
}

export default function MensagensClient({ initialTemplates, academy }: Props) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [activeTab, setActiveTab] = useState<ReminderType>('d10')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const currentTemplate = templates[activeTab]

  // Mock de aluno para preview
  const mockStudent = {
    name: 'João Jiu-Jitsu',
    monthly_value: 150.00,
  }

  const sampleDueDate = new Date()
  if (activeTab === 'd10') sampleDueDate.setDate(sampleDueDate.getDate() + 10)
  if (activeTab === 'd5') sampleDueDate.setDate(sampleDueDate.getDate() + 5)

  const previewText = buildMessage(
    currentTemplate.content,
    mockStudent,
    academy,
    sampleDueDate,
    activeTab
  )

  function handleChangeContent(content: string) {
    setTemplates(t => ({
      ...t,
      [activeTab]: { ...t[activeTab], content },
    }))
  }

  function handleRestoreDefault() {
    setTemplates(t => ({
      ...t,
      [activeTab]: { ...t[activeTab], content: DEFAULT_TEMPLATES[activeTab] },
    }))
  }

  async function handleSave() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminder_type: activeTab,
          content: currentTemplate.content,
          active: currentTemplate.active,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error || 'Erro ao salvar template.' })
        return
      }

      setMessage({ type: 'success', text: 'Template salvo com sucesso!' })
    } catch {
      setMessage({ type: 'error', text: 'Erro de conexão.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Templates de Mensagem</h1>
          <p className={styles.pageSubtitle}>Personalize o tom dos lembretes de cobrança simpática.</p>
        </div>
      </div>

      {/* Abas */}
      <div className={styles.tabs} role="tablist">
        {(['d10', 'd5', 'd0'] as ReminderType[]).map((type) => (
          <button
            key={type}
            role="tab"
            aria-selected={activeTab === type}
            className={`${styles.tab} ${activeTab === type ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab(type); setMessage(null) }}
            id={`tab-template-${type}`}
          >
            {type.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Feedback message */}
      {message && (
        <div className={`badge ${message.type === 'success' ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 12px', fontSize: '13px', marginBottom: '16px' }}>
          {message.text}
        </div>
      )}

      {/* Editor + Preview Grid */}
      <div className={styles.editorGrid}>
        {/* Editor */}
        <div className="card">
          <div className={styles.templateMeta}>
            <h2 className={styles.templateTitle}>{templateInfo[activeTab].title}</h2>
            <p className={styles.templateDesc}>{templateInfo[activeTab].desc}</p>
          </div>

          <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
            <label htmlFor="template-editor" className="form-label">Conteúdo da mensagem</label>
            <textarea
              id="template-editor"
              className="form-textarea"
              rows={6}
              value={currentTemplate.content}
              onChange={(e) => handleChangeContent(e.target.value)}
            />
          </div>

          {/* Variáveis disponíveis */}
          <div className={styles.variablesSection}>
            <div className={styles.variablesTitle}>Variáveis dinâmicas suportadas:</div>
            <div className={styles.variablesGrid}>
              <code>&#123;&#123;nome&#125;&#125;</code> Nome do aluno
              <code>&#123;&#123;dias&#125;&#125;</code> Dias até o vencimento
              <code>&#123;&#123;data_vencimento&#125;&#125;</code> Data formatada
              <code>&#123;&#123;valor&#125;&#125;</code> Valor da mensalidade
              <code>&#123;&#123;academia&#125;&#125;</code> Nome da academia
              <code>&#123;&#123;chave_pix&#125;&#125;</code> Chave Pix cadastrada
            </div>
          </div>

          <div className={styles.editorActions}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRestoreDefault}
              id={`restore-default-${activeTab}`}
            >
              Restaurar padrão
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={loading}
              id={`save-template-${activeTab}`}
            >
              {loading ? <span className="spinner spinner-sm" /> : 'Salvar template'}
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="card">
          <h2 className={styles.templateTitle} style={{ marginBottom: 'var(--space-4)' }}>
            👁 Preview no WhatsApp
          </h2>
          <div className={styles.waPreviewBox}>
            <div className={styles.waBubble}>
              <p className={styles.waText}>{previewText}</p>
              <span className={styles.waTime}>10:00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
