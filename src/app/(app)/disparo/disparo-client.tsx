'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentWithStatus, Academy, MessageTemplate, ReminderType } from '@/types'
import { getDueStatus, getDueStatusLabel } from '@/lib/billing'
import { formatPhoneDisplay } from '@/lib/phone'
import styles from './disparo.module.css'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MessageMode = ReminderType | 'custom'

interface QueueItem {
  logId: string
  studentName: string
  studentPhone: string
  waLink: string
  messageText: string
  studentMeta: string
}

type Phase = 'select' | 'confirm' | 'queue' | 'summary'

interface Props {
  students: StudentWithStatus[]
  academy: Academy
  templates: MessageTemplate[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badgeClass(status: ReturnType<typeof getDueStatus>) {
  if (status === 'overdue' || status === 'due_today') return 'badge-danger'
  if (status === 'due_soon') return 'badge-warning'
  if (status === 'inactive') return 'badge-neutral'
  return 'badge-success'
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DisparoClient({ students, academy, templates }: Props) {
  const router = useRouter()

  // Fase da UI
  const [phase, setPhase] = useState<Phase>('select')

  // Seleção
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  // Mensagem
  const [mode, setMode] = useState<MessageMode>('d0')
  const [customMessage, setCustomMessage] = useState('')

  // Fila
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [sentItems, setSentItems] = useState<QueueItem[]>([])
  const [skippedItems, setSkippedItems] = useState<QueueItem[]>([])
  const [sending, setSending] = useState(false)
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Alunos filtrados
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return students.filter((s) => {
      const matchSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        s.phone_raw.includes(q)
      return matchSearch
    })
  }, [students, search])

  const activeStudents = useMemo(() => students.filter((s) => s.status === 'active'), [students])

  // ── Seleção ─────────────────────────────────────────────────────────────────

  function toggleStudent(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(activeStudents.map((s) => s.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  // ── Criação da fila (POST /api/reminders/bulk) ────────────────────────────

  async function handleConfirm() {
    setSending(true)
    try {
      const items = Array.from(selected).map((id) => ({
        studentId: id,
        reminderType: mode,
        ...(mode === 'custom' ? { customMessage } : {}),
      }))

      const res = await fetch('/api/reminders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(`Erro ao criar lembretes: ${err.error}`)
        return
      }

      const data = await res.json()
      const logs: QueueItem[] = (data.created || []).map((log: any) => {
        const student = students.find((s) => s.id === log.student_id)
        const daysLabel = student?.daysUntilDue !== null && student?.daysUntilDue !== undefined
          ? `Vence em ${student.daysUntilDue}d`
          : ''
        const valueLabel = student?.monthly_value
          ? `R$ ${student.monthly_value.toFixed(2).replace('.', ',')}`
          : ''
        const metaParts = [daysLabel, valueLabel].filter(Boolean)
        return {
          logId: log.id,
          studentName: log.student_name,
          studentPhone: log.student_phone,
          waLink: log.wa_link,
          messageText: log.message_text,
          studentMeta: metaParts.join(' · '),
        }
      })

      if (logs.length === 0) {
        alert('Nenhum lembrete foi criado. Os alunos selecionados podem já ter lembrete pendente hoje.')
        return
      }

      setQueue(logs)
      setQueueIndex(0)
      setSentItems([])
      setSkippedItems([])
      setPhase('queue')
    } finally {
      setSending(false)
    }
  }

  // ── Fila sequencial ──────────────────────────────────────────────────────────

  const currentItem = queue[queueIndex]
  const progress = queue.length > 0 ? ((queueIndex) / queue.length) * 100 : 0

  const advanceQueue = useCallback((item: QueueItem, wasSent: boolean) => {
    if (wasSent) setSentItems(prev => [...prev, item])
    else setSkippedItems(prev => [...prev, item])

    const nextIndex = queueIndex + 1
    if (nextIndex >= queue.length) {
      setPhase('summary')
    } else {
      setQueueIndex(nextIndex)
    }
  }, [queueIndex, queue.length])

  async function markSent(item: QueueItem) {
    await fetch(`/api/reminders/${item.logId}/mark-sent`, { method: 'POST' })
  }

  function openWhatsApp(item: QueueItem) {
    // Abre wa.me em nova aba
    window.open(item.waLink, '_blank', 'noopener,noreferrer')
    // Marcar como enviado no banco (não aguarda)
    markSent(item)
    // Agendar avanço automático após 2s
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    autoAdvanceTimer.current = setTimeout(() => {
      advanceQueue(item, true)
    }, 2000)
  }

  function skipItem(item: QueueItem) {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    advanceQueue(item, false)
  }

  function goBack() {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    if (queueIndex > 0) {
      setQueueIndex(prev => prev - 1)
    }
  }

  // Limpar timer ao desmontar
  useEffect(() => () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
  }, [])

  // ── Template preview ─────────────────────────────────────────────────────────

  const templateForMode: Record<ReminderType, string> = {
    d10: templates.find((t) => t.reminder_type === 'd10')?.content || '(template D-10 não configurado)',
    d5: templates.find((t) => t.reminder_type === 'd5')?.content || '(template D-5 não configurado)',
    d0: templates.find((t) => t.reminder_type === 'd0')?.content || '(template D-0 não configurado)',
  }

  // ── Renderização ─────────────────────────────────────────────────────────────

  // FASE: RESUMO
  if (phase === 'summary') {
    const total = sentItems.length + skippedItems.length
    return (
      <div className="page-container">
        <div className={styles.summaryContainer}>
          <div className={styles.summaryIcon}>{sentItems.length === queue.length ? '🎉' : '✅'}</div>
          <h1 className={styles.summaryTitle}>Disparo concluído!</h1>
          <p className={styles.summaryDesc}>
            Você terminou a fila de disparo manual.
          </p>
          <div className={styles.summaryStats}>
            <div className={styles.summaryStat}>
              <div className={styles.summaryStatValue} style={{ color: 'var(--color-success, #22c55e)' }}>
                {sentItems.length}
              </div>
              <div className={styles.summaryStatLabel}>Enviados</div>
            </div>
            <div className={styles.summaryStat}>
              <div className={styles.summaryStatValue} style={{ color: 'var(--color-text-muted)' }}>
                {skippedItems.length}
              </div>
              <div className={styles.summaryStatLabel}>Pulados</div>
            </div>
            <div className={styles.summaryStat}>
              <div className={styles.summaryStatValue}>{total}</div>
              <div className={styles.summaryStatLabel}>Total</div>
            </div>
          </div>
          <div className={styles.summaryActions}>
            <button className="btn btn-ghost" onClick={() => {
              setPhase('select')
              setSelected(new Set())
              setQueue([])
              setQueueIndex(0)
              setSentItems([])
              setSkippedItems([])
            }}>
              Novo disparo
            </button>
            <button className="btn btn-ghost" onClick={() => router.push('/historico')}>
              Ver histórico
            </button>
            <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>
              Voltar ao dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // FASE: FILA SEQUENCIAL
  if (phase === 'queue' && currentItem) {
    const pct = queue.length > 0 ? Math.round(((queueIndex) / queue.length) * 100) : 0
    return (
      <div className="page-container">
        <div className={styles.queueContainer}>
          <div className={styles.queueHeader}>
            <h1 className={styles.queueTitle}>
              Enviando {queueIndex + 1} de {queue.length}
            </h1>
            <p className={styles.queueSubtitle}>
              Clique em &quot;Abrir WhatsApp&quot; para enviar a mensagem ao aluno.
            </p>
          </div>

          <div className={styles.progressBar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>

          <div key={currentItem.logId} className={`${styles.queueCard} card`}>
            <div className={styles.queueStudentName}>👤 {currentItem.studentName}</div>
            <div className={styles.queueStudentMeta}>
              {formatPhoneDisplay(currentItem.studentPhone)}
              {currentItem.studentMeta ? ` · ${currentItem.studentMeta}` : ''}
            </div>

            <div className={styles.messagePreview}>{currentItem.messageText}</div>

            <div className={styles.queueActions}>
              {queueIndex > 0 && (
                <button
                  className={`btn btn-ghost btn-sm ${styles.queueActionBack}`}
                  onClick={goBack}
                  id="queue-back-btn"
                >
                  ← Voltar
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => skipItem(currentItem)}
                id={`queue-skip-${currentItem.logId}`}
              >
                Pular →
              </button>
              <button
                className="btn btn-success"
                onClick={() => openWhatsApp(currentItem)}
                id={`queue-open-wa-${currentItem.logId}`}
              >
                📱 Abrir WhatsApp
              </button>
            </div>
          </div>

          {sentItems.length > 0 && (
            <div className={styles.sentList}>
              {sentItems.map((item) => (
                <div key={item.logId} className={styles.sentItem}>
                  <span style={{ color: 'var(--color-success, #22c55e)' }}>✓</span>
                  <span>{item.studentName}</span>
                  <span style={{ opacity: 0.5 }}>— enviado</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // FASE: SELEÇÃO + MENSAGEM + CONFIRMAÇÃO
  return (
    <div className="page-container">
      {/* Modal de confirmação */}
      {phase === 'confirm' && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Confirmar disparo</h2>
            <p className={styles.modalDesc}>
              Você está prestes a enviar lembretes para{' '}
              <strong>{selected.size} aluno{selected.size !== 1 ? 's' : ''}</strong>.{' '}
              Um link do WhatsApp será aberto para cada aluno, um por vez.
            </p>
            <div className={styles.modalActions}>
              <button
                className="btn btn-ghost"
                onClick={() => setPhase('select')}
                disabled={sending}
                id="confirm-cancel-btn"
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={sending}
                id="confirm-dispatch-btn"
              >
                {sending ? <span className="spinner spinner-sm" /> : null}
                {sending ? 'Preparando…' : `Confirmar (${selected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Disparo Manual</h1>
          <p className={styles.pageSubtitle}>
            Selecione alunos, escolha a mensagem e abra os links do WhatsApp em sequência.
          </p>
        </div>
      </div>

      {/* ── PASSO 1: Seleção de alunos ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Selecionar alunos</h2>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={selectAll}
            id="select-all-btn"
          >
            ✓ Selecionar todos ativos
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={clearSelection}
            id="clear-selection-btn"
          >
            ✗ Limpar seleção
          </button>
          <span className={styles.selectionCount}>
            <span className={styles.selectionCountHighlight}>{selected.size}</span>
            {' '}aluno{selected.size !== 1 ? 's' : ''} selecionado{selected.size !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Busca */}
        <div className={styles.searchWrap}>
          <input
            id="disparo-search"
            type="search"
            className="form-input"
            placeholder="Buscar por nome ou telefone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className={styles.emptyNote}>Nenhum aluno encontrado.</div>
        ) : (
          <div className={styles.studentList}>
            {filtered.map((s) => {
              const status = getDueStatus(s.daysUntilDue)
              const label = getDueStatusLabel(status, s.daysUntilDue ?? undefined)
              const isSelected = selected.has(s.id)
              return (
                <label
                  key={s.id}
                  className={`card card-sm ${styles.studentItem} ${isSelected ? styles.studentItemSelected : ''}`}
                  htmlFor={`student-check-${s.id}`}
                >
                  <input
                    type="checkbox"
                    id={`student-check-${s.id}`}
                    className={styles.checkbox}
                    checked={isSelected}
                    onChange={() => toggleStudent(s.id)}
                  />
                  <div className={styles.studentInfo}>
                    <div className={styles.studentName}>{s.name}</div>
                    <div className={styles.studentMeta}>
                      {formatPhoneDisplay(s.phone_e164)}
                      {s.due_day ? ` · Venc. dia ${s.due_day}` : ''}
                      {s.monthly_value
                        ? ` · R$ ${s.monthly_value.toFixed(2).replace('.', ',')}`
                        : ''}
                    </div>
                  </div>
                  <div className={styles.studentRight}>
                    <span className={`badge ${badgeClass(status)}`}>{label}</span>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </section>

      {/* ── PASSO 2: Escolha da mensagem ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Mensagem</h2>
        <div className={styles.messagePanel}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="message-mode-select">
              Tipo de mensagem
            </label>
            <select
              id="message-mode-select"
              className="form-input"
              value={mode}
              onChange={(e) => setMode(e.target.value as MessageMode)}
            >
              <option value="d0">D-0 — Vence hoje</option>
              <option value="d5">D-5 — Vence em 5 dias</option>
              <option value="d10">D-10 — Vence em 10 dias</option>
              <option value="custom">✍️ Mensagem livre</option>
            </select>
          </div>

          {mode !== 'custom' ? (
            <div className={styles.formGroup}>
              <label className={styles.label}>Prévia do template (texto real é gerado por aluno)</label>
              <div className={styles.messagePreview}>
                {templateForMode[mode as ReminderType]}
              </div>
            </div>
          ) : (
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="custom-message-textarea">
                Sua mensagem
              </label>
              <textarea
                id="custom-message-textarea"
                className={`form-input ${styles.textarea}`}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Digite sua mensagem aqui…"
              />
              <p className={styles.variablesHint}>
                Variáveis disponíveis:{' '}
                <code>{'{{nome}}'}</code>{' '}
                <code>{'{{chave_pix}}'}</code>{' '}
                <code>{'{{academia}}'}</code>{' '}
                <code>{'{{dias}}'}</code>{' '}
                <code>{'{{data_vencimento}}'}</code>{' '}
                <code>{'{{valor}}'}</code>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer com botão de disparo ── */}
      <div className={styles.footer}>
        <div className={styles.footerInfo}>
          {selected.size === 0
            ? 'Selecione pelo menos 1 aluno para disparar.'
            : `${selected.size} aluno${selected.size !== 1 ? 's' : ''} selecionado${selected.size !== 1 ? 's' : ''}`}
        </div>
        <button
          className="btn btn-primary btn-lg"
          disabled={
            selected.size === 0 ||
            (mode === 'custom' && customMessage.trim().length === 0) ||
            phase === 'confirm'
          }
          onClick={() => setPhase('confirm')}
          id="dispatch-btn"
        >
          🚀 Disparar agora ({selected.size})
        </button>
      </div>
    </div>
  )
}
