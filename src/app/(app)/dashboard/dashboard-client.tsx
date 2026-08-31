'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { DashboardStats, StudentWithStatus, ReminderLog, Academy } from '@/types'
import { getDueStatus, getDueStatusLabel } from '@/lib/billing'
import styles from './dashboard.module.css'

interface Props {
  stats: DashboardStats
  upcoming: StudentWithStatus[]
  pendingReminders: any[]
  academy: Academy | null
  studentCount: number
}

function StatCard({ label, value, sub, color }: {
  label: string
  value: number
  sub?: string
  color?: 'success' | 'warning' | 'danger' | 'neutral'
}) {
  const colorClass = color ? styles[`stat${color.charAt(0).toUpperCase() + color.slice(1)}`] : ''
  return (
    <div className={`${styles.statCard} card`}>
      <div className={`${styles.statValue} ${colorClass}`}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}

export default function DashboardClient({ stats, upcoming, pendingReminders, academy, studentCount }: Props) {
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // Mensagem contextual
  function getContextMessage() {
    if (studentCount === 0) return null
    if (stats.dueToday > 0) return `Hoje você tem ${stats.dueToday} mensalidade${stats.dueToday > 1 ? 's' : ''} vencendo. 🥋`
    if (stats.overdue > 0) return `${stats.overdue} aluno${stats.overdue > 1 ? 's' : ''} com mensalidade vencida.`
    if (stats.dueSoon > 0) return `${stats.dueSoon} mensalidade${stats.dueSoon > 1 ? 's' : ''} vencendo nos próximos dias.`
    return 'Está tudo em dia. Oss! 🥋'
  }

  async function handleSendReminder(reminder: any) {
    if (sentIds.has(reminder.id)) return
    setConfirmId(reminder.id)
  }

  async function confirmSend(reminder: any) {
    setConfirmId(null)
    setSendingId(reminder.id)
    try {
      // Abrir wa.me link
      if (reminder.wa_link) {
        window.open(reminder.wa_link, '_blank')
      }
      // Marcar como enviado
      const res = await fetch(`/api/reminders/${reminder.id}/mark-sent`, { method: 'POST' })
      if (res.ok) {
        setSentIds(prev => new Set([...prev, reminder.id]))
      }
    } finally {
      setSendingId(null)
    }
  }

  const contextMsg = getContextMessage()

  return (
    <div className="page-container">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          {academy && <p className={styles.academyName}>{academy.name}</p>}
        </div>
      </div>

      {/* Estado vazio */}
      {studentCount === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🥋</div>
          <div className="empty-state-title">Bem-vindo ao RF Team!</div>
          <p className="empty-state-desc">Cadastre seu primeiro aluno para começar a controlar as mensalidades de forma automática.</p>
          <Link href="/alunos/novo" className="btn btn-primary btn-lg" id="dashboard-add-first-student">
            Cadastrar primeiro aluno
          </Link>
        </div>
      )}

      {studentCount > 0 && (
        <>
          {/* Mensagem contextual */}
          {contextMsg && (
            <div className={styles.contextMsg}>
              <span>{contextMsg}</span>
            </div>
          )}

          {/* Cards de estatísticas */}
          <div className={styles.statsGrid}>
            <StatCard label="Total de alunos" value={stats.total} />
            <StatCard label="Em dia" value={stats.onTime} color="success" />
            <StatCard label="Vencendo" value={stats.dueSoon} color="warning" />
            <StatCard label="Vencidos" value={stats.overdue} color="danger" />
          </div>

          {/* Lembretes pendentes de hoje */}
          {pendingReminders.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                📬 Lembretes de hoje
                <span className={styles.sectionBadge}>{pendingReminders.length}</span>
              </h2>
              <div className={styles.reminderList}>
                {pendingReminders.map((r: any) => {
                  const isSent = sentIds.has(r.id)
                  const isSending = sendingId === r.id
                  const isConfirming = confirmId === r.id

                  return (
                    <div key={r.id} className={`${styles.reminderItem} card card-sm`}>
                      <div className={styles.reminderInfo}>
                        <div className={styles.reminderName}>{r.students?.name}</div>
                        <div className={styles.reminderType}>
                          {r.reminder_type === 'd0' ? 'Vence hoje' :
                           r.reminder_type === 'd5' ? 'Vence em 5 dias' : 'Vence em 10 dias'}
                        </div>
                      </div>
                      <div className={styles.reminderActions}>
                        {isSent ? (
                          <span className="badge badge-success">Enviado ✓</span>
                        ) : isConfirming ? (
                          <div className={styles.confirmRow}>
                            <span className={styles.confirmText}>Confirmar envio?</span>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => confirmSend(r)}
                              id={`confirm-send-${r.id}`}
                            >
                              Sim
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setConfirmId(null)}
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleSendReminder(r)}
                            disabled={isSending}
                            id={`send-reminder-${r.id}`}
                          >
                            {isSending ? <span className="spinner spinner-sm" /> : null}
                            Enviar no WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Próximos vencimentos */}
          {upcoming.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Próximos vencimentos</h2>
                <Link href="/alunos" className="btn btn-ghost btn-sm">Ver todos →</Link>
              </div>
              <div className={styles.upcomingList}>
                {upcoming.map((s) => {
                  const status = getDueStatus(s.daysUntilDue)
                  const label = getDueStatusLabel(status, s.daysUntilDue ?? undefined)
                  const badgeClass =
                    status === 'overdue' ? 'badge-danger' :
                    status === 'due_today' ? 'badge-danger' :
                    status === 'due_soon' ? 'badge-warning' :
                    'badge-success'

                  return (
                    <Link
                      key={s.id}
                      href={`/alunos/${s.id}`}
                      className={`${styles.upcomingItem} card card-sm`}
                    >
                      <div className={styles.upcomingInfo}>
                        <div className={styles.upcomingName}>{s.name}</div>
                        {s.dueDateFormatted && (
                          <div className={styles.upcomingDate}>Vence {s.dueDateFormatted}</div>
                        )}
                      </div>
                      <span className={`badge ${badgeClass}`}>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
