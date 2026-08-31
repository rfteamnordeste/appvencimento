'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { StudentWithStatus } from '@/types'
import { getDueStatus, getDueStatusLabel } from '@/lib/billing'
import { formatPhoneDisplay } from '@/lib/phone'
import styles from './alunos.module.css'

type FilterType = 'all' | 'on_time' | 'due_soon' | 'due_today' | 'overdue' | 'inactive'

interface Props {
  students: StudentWithStatus[]
  academyId: string
}

export default function AlunosClient({ students, academyId }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  // Filtragem
  const filtered = students.filter((s) => {
    const status = getDueStatus(s.daysUntilDue)
    const matchFilter =
      filter === 'all' ||
      (filter === 'on_time' && status === 'on_time') ||
      (filter === 'due_soon' && status === 'due_soon') ||
      (filter === 'due_today' && status === 'due_today') ||
      (filter === 'overdue' && status === 'overdue') ||
      (filter === 'inactive' && status === 'inactive')

    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.phone_raw.includes(q) ||
      s.phone_e164.includes(q)

    return matchFilter && matchSearch
  })

  async function toggleStatus(studentId: string, currentStatus: string) {
    setLoading(studentId)
    try {
      await fetch(`/api/students/${studentId}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStatus }),
      })
      router.refresh()
    } finally {
      setLoading(null)
      setConfirmDeactivate(null)
    }
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'due_today', label: 'Vence hoje' },
    { key: 'overdue', label: 'Vencidos' },
    { key: 'due_soon', label: 'Vencendo' },
    { key: 'on_time', label: 'Em dia' },
    { key: 'inactive', label: 'Inativos' },
  ]

  return (
    <div className="page-container">
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Alunos</h1>
        <Link href="/alunos/novo" className="btn btn-primary" id="add-student-btn">
          + Novo aluno
        </Link>
      </div>

      {/* Busca */}
      <div className={styles.searchWrap}>
        <input
          id="student-search"
          type="search"
          className="form-input"
          placeholder="Buscar por nome ou WhatsApp…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filtros */}
      <div className={styles.filters} role="group" aria-label="Filtrar alunos">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`${styles.filterBtn} ${filter === f.key ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f.key)}
            id={`filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">
            {students.length === 0 ? 'Nenhum aluno cadastrado' : 'Nenhum resultado'}
          </div>
          <p className="empty-state-desc">
            {students.length === 0
              ? 'Adicione seu primeiro aluno para começar.'
              : 'Tente outro filtro ou busca.'}
          </p>
          {students.length === 0 && (
            <Link href="/alunos/novo" className="btn btn-primary" id="empty-add-student">
              Adicionar primeiro aluno
            </Link>
          )}
        </div>
      ) : (
        <div className={styles.studentList}>
          <div className={styles.listMeta}>
            {filtered.length} aluno{filtered.length !== 1 ? 's' : ''}
          </div>
          {filtered.map((s) => {
            const status = getDueStatus(s.daysUntilDue)
            const label = getDueStatusLabel(status, s.daysUntilDue ?? undefined)
            const badgeClass =
              status === 'overdue' || status === 'due_today' ? 'badge-danger' :
              status === 'due_soon' ? 'badge-warning' :
              status === 'inactive' ? 'badge-neutral' :
              'badge-success'
            const isDeactivating = confirmDeactivate === s.id

            return (
              <div key={s.id} className={`${styles.studentCard} card card-sm ${s.status === 'inactive' ? styles.inactive : ''}`}>
                <div className={styles.studentMain}>
                  <div className={styles.studentInfo}>
                    <div className={styles.studentName}>{s.name}</div>
                    <div className={styles.studentPhone}>{formatPhoneDisplay(s.phone_e164)}</div>
                    {s.due_day && (
                      <div className={styles.studentDue}>
                        Venc. dia {s.due_day}
                        {s.monthly_value && ` · R$ ${s.monthly_value.toFixed(2).replace('.', ',')}`}
                      </div>
                    )}
                  </div>
                  <div className={styles.studentRight}>
                    <span className={`badge ${badgeClass}`}>{label}</span>
                  </div>
                </div>

                <div className={styles.studentActions}>
                  <Link
                    href={`/alunos/${s.id}`}
                    className="btn btn-ghost btn-sm"
                    id={`view-student-${s.id}`}
                  >
                    Ver
                  </Link>
                  <Link
                    href={`/alunos/${s.id}/editar`}
                    className="btn btn-ghost btn-sm"
                    id={`edit-student-${s.id}`}
                  >
                    Editar
                  </Link>

                  {isDeactivating ? (
                    <>
                      <span className={styles.confirmText}>
                        {s.status === 'active' ? 'Desativar?' : 'Reativar?'}
                      </span>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => toggleStatus(s.id, s.status)}
                        disabled={loading === s.id}
                        id={`confirm-toggle-${s.id}`}
                      >
                        {loading === s.id ? <span className="spinner spinner-sm" /> : 'Sim'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmDeactivate(null)}
                      >
                        Não
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmDeactivate(s.id)}
                      id={`toggle-student-${s.id}`}
                    >
                      {s.status === 'active' ? 'Desativar' : 'Reativar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
