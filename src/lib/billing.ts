import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { addMonths, setDate, differenceInCalendarDays, format } from 'date-fns'
import type { ReminderType } from '@/types'

export const REMINDER_DAYS: Record<ReminderType, number> = {
  d10: 10,
  d5: 5,
  d0: 0,
}

export const DEFAULT_TEMPLATES: Record<ReminderType, string> = {
  d10: `🥋 Fala, {{nome}}! Passando pra lembrar que sua mensalidade da {{academia}} vence em {{dias}} dias ({{data_vencimento}}). Se quiser adiantar, nossa chave Pix é {{chave_pix}}. Bora pro treino! 💪`,
  d5: `🥋 Fala, {{nome}}! Sua mensalidade vence em {{dias}} dias ({{data_vencimento}}). Chave Pix pra facilitar: {{chave_pix}}. Qualquer coisa, é só chamar. Oss! 👊`,
  d0: `🥋 Fala, {{nome}}! Hoje é o vencimento da sua mensalidade{{#if valor}} no valor de {{valor}}{{/if}}. Chave Pix da {{academia}}: {{chave_pix}}. Quando puder, dá aquela conferida. Valeu por fazer parte do time! 🦏`,
}

/**
 * Dado o due_day do aluno e a timezone da academia,
 * retorna a data de vencimento do ciclo vigente (próximo vencimento).
 *
 * Regra: se hoje é anterior ao due_day, o vencimento é este mês.
 * Se hoje já passou do due_day, o vencimento é no próximo mês.
 */
export function getNextDueDate(dueDay: number, timezone: string): Date {
  const nowInTz = toZonedTime(new Date(), timezone)
  const todayDay = nowInTz.getDate()

  let dueDate = setDate(nowInTz, dueDay)

  // Se o dia de hoje já passou do vencimento, pular para próximo mês
  if (todayDay > dueDay) {
    dueDate = setDate(addMonths(nowInTz, 1), dueDay)
  }

  return dueDate
}

/**
 * Retorna quantos dias faltam para o vencimento (pode ser negativo = vencido).
 */
export function getDaysUntilDue(dueDay: number, timezone: string): number {
  const nowInTz = toZonedTime(new Date(), timezone)
  const dueDate = getNextDueDate(dueDay, timezone)

  // Normalizar para meia-noite para comparação por dia calendário
  const todayMidnight = new Date(
    nowInTz.getFullYear(),
    nowInTz.getMonth(),
    nowInTz.getDate()
  )
  const dueMidnight = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate()
  )

  return differenceInCalendarDays(dueMidnight, todayMidnight)
}

/**
 * Retorna o cycle_key (identificador único de idempotência).
 * Formato: academyId|studentId|YYYY-MM-DD
 */
export function buildCycleKey(
  academyId: string,
  studentId: string,
  dueDate: Date
): string {
  return `${academyId}|${studentId}|${format(dueDate, 'yyyy-MM-dd')}`
}

/**
 * Dado os dias até o vencimento, retorna qual reminder_type deve ser enviado hoje.
 * Retorna null se não é um dia de lembrete.
 */
export function getReminderTypeForToday(daysUntilDue: number): ReminderType | null {
  if (daysUntilDue === 10) return 'd10'
  if (daysUntilDue === 5) return 'd5'
  if (daysUntilDue === 0) return 'd0'
  return null
}

/**
 * Status visual baseado nos dias até o vencimento.
 */
export type DueStatus = 'overdue' | 'due_today' | 'due_soon' | 'on_time' | 'inactive'

export function getDueStatus(daysUntilDue: number | null): DueStatus {
  if (daysUntilDue === null) return 'inactive'
  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue === 0) return 'due_today'
  if (daysUntilDue <= 10) return 'due_soon'
  return 'on_time'
}

export function getDueStatusLabel(status: DueStatus, days?: number): string {
  switch (status) {
    case 'overdue':
      return days !== undefined ? `Vencido há ${Math.abs(days)}d` : 'Vencido'
    case 'due_today':
      return 'Vence hoje'
    case 'due_soon':
      return days !== undefined ? `Vence em ${days}d` : 'Vencendo'
    case 'on_time':
      return days !== undefined ? `Em dia (${days}d)` : 'Em dia'
    case 'inactive':
      return 'Inativo'
  }
}

/**
 * Formata data para exibição no Brasil.
 */
export function formatDueDate(date: Date): string {
  return format(date, 'dd/MM/yyyy')
}
