'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Student } from '@/types'
import { maskPhone, normalizePhone } from '@/lib/phone'
import styles from './student-form.module.css'

interface Props {
  student?: Student
  academyId: string
}

interface FormData {
  name: string
  phone: string
  due_day: string
  monthly_value: string
  status: 'active' | 'inactive'
  notes: string
}

interface FormErrors {
  name?: string
  phone?: string
  due_day?: string
}

export default function StudentForm({ student, academyId }: Props) {
  const router = useRouter()
  const isEditing = !!student

  const [form, setForm] = useState<FormData>({
    name: student?.name || '',
    phone: student?.phone_raw || '',
    due_day: student?.due_day?.toString() || '',
    monthly_value: student?.monthly_value?.toString() || '',
    status: student?.status || 'active',
    notes: student?.notes || '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  function handlePhoneChange(value: string) {
    setForm(f => ({ ...f, phone: maskPhone(value) }))
    setErrors(e => ({ ...e, phone: undefined }))
  }

  function validate(): boolean {
    const newErrors: FormErrors = {}

    if (!form.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }

    if (!form.phone.trim()) {
      newErrors.phone = 'WhatsApp é obrigatório'
    } else {
      const { error } = normalizePhone(form.phone)
      if (error) newErrors.phone = error
    }

    const day = parseInt(form.due_day)
    if (!form.due_day || isNaN(day) || day < 1 || day > 28) {
      newErrors.due_day = 'Dia de vencimento deve ser entre 1 e 28'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setApiError('')

    const { e164 } = normalizePhone(form.phone)

    const payload = {
      academy_id: academyId,
      name: form.name.trim(),
      phone_raw: form.phone,
      phone_e164: e164,
      due_day: parseInt(form.due_day),
      monthly_value: form.monthly_value ? parseFloat(form.monthly_value) : null,
      status: form.status,
      notes: form.notes.trim() || null,
    }

    try {
      const url = isEditing ? `/api/students/${student.id}` : '/api/students'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setApiError(data.error || 'Erro ao salvar aluno. Tente novamente.')
        return
      }

      router.push('/alunos')
      router.refresh()
    } catch {
      setApiError('Erro de conexão. Verifique sua internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} id="student-form" noValidate>
      {apiError && (
        <div className={styles.apiError} role="alert">
          <span>⚠</span> {apiError}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="student-name" className="form-label">
          Nome completo <span className="required">*</span>
        </label>
        <input
          id="student-name"
          type="text"
          className={`form-input ${errors.name ? 'error' : ''}`}
          placeholder="João da Silva"
          value={form.name}
          onChange={(e) => { setForm(f => ({ ...f, name: e.target.value })); setErrors(e2 => ({ ...e2, name: undefined })) }}
          disabled={loading}
          autoComplete="name"
        />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="student-phone" className="form-label">
          WhatsApp <span className="required">*</span>
        </label>
        <input
          id="student-phone"
          type="tel"
          className={`form-input ${errors.phone ? 'error' : ''}`}
          placeholder="(84) 99999-9999"
          value={form.phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          disabled={loading}
          autoComplete="tel"
          inputMode="tel"
        />
        {errors.phone && <span className="form-error">{errors.phone}</span>}
        <span className="form-hint">Número com DDD. Será normalizado para WhatsApp automaticamente.</span>
      </div>

      <div className="form-group">
        <label htmlFor="student-due-day" className="form-label">
          Dia de vencimento (todo mês) <span className="required">*</span>
        </label>
        <input
          id="student-due-day"
          type="number"
          className={`form-input ${errors.due_day ? 'error' : ''}`}
          placeholder="Ex: 10"
          min={1}
          max={28}
          value={form.due_day}
          onChange={(e) => { setForm(f => ({ ...f, due_day: e.target.value })); setErrors(e2 => ({ ...e2, due_day: undefined })) }}
          disabled={loading}
          inputMode="numeric"
        />
        {errors.due_day && <span className="form-error">{errors.due_day}</span>}
        <span className="form-hint">Entre 1 e 28. O sistema calculará D-10, D-5 e D-0 automaticamente.</span>
      </div>

      <div className="form-group">
        <label htmlFor="student-value" className="form-label">Valor da mensalidade (opcional)</label>
        <input
          id="student-value"
          type="number"
          className="form-input"
          placeholder="Ex: 150.00"
          min={0}
          step={0.01}
          value={form.monthly_value}
          onChange={(e) => setForm(f => ({ ...f, monthly_value: e.target.value }))}
          disabled={loading}
          inputMode="decimal"
        />
        <span className="form-hint">Se preenchido, será exibido na mensagem de lembrete.</span>
      </div>

      {isEditing && (
        <div className="form-group">
          <label htmlFor="student-status" className="form-label">Status</label>
          <select
            id="student-status"
            className="form-select"
            value={form.status}
            onChange={(e) => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
            disabled={loading}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="student-notes" className="form-label">Observações (opcional)</label>
        <textarea
          id="student-notes"
          className="form-textarea"
          placeholder="Alguma nota sobre este aluno…"
          value={form.notes}
          onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
          disabled={loading}
          rows={3}
        />
      </div>

      <div className={styles.formActions}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.back()}
          disabled={loading}
          id="student-form-cancel"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          id="student-form-submit"
        >
          {loading ? (
            <><span className="spinner spinner-sm" /> Salvando…</>
          ) : (
            isEditing ? 'Salvar alterações' : 'Cadastrar aluno'
          )}
        </button>
      </div>
    </form>
  )
}
