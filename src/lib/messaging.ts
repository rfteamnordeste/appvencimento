import type { Student, Academy, MessageTemplate, ReminderType } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getNextDueDate, REMINDER_DAYS } from './billing'

/**
 * Substitui as variáveis do template pela informação real do aluno/academia.
 */
export function buildMessage(
  template: string,
  student: Pick<Student, 'name' | 'monthly_value'>,
  academy: Pick<Academy, 'name' | 'pix_key'>,
  dueDate: Date,
  reminderType: ReminderType
): string {
  const daysUntil = REMINDER_DAYS[reminderType]
  const dueDateFormatted = format(dueDate, "dd 'de' MMMM", { locale: ptBR })
  const valorStr = student.monthly_value
    ? `R$ ${student.monthly_value.toFixed(2).replace('.', ',')}`
    : ''

  return template
    .replace(/\{\{nome\}\}/g, student.name)
    .replace(/\{\{dias\}\}/g, String(daysUntil))
    .replace(/\{\{data_vencimento\}\}/g, dueDateFormatted)
    .replace(/\{\{valor\}\}/g, valorStr)
    .replace(/\{\{academia\}\}/g, academy.name)
    .replace(/\{\{chave_pix\}\}/g, academy.pix_key || '(configure a chave Pix nas configurações)')
    .replace(/\{\{#if valor\}\}[\s\S]*?\{\{\/if\}\}/g, valorStr ? valorStr : '')
    .trim()
}

/**
 * Gera o link wa.me com a mensagem pré-preenchida.
 */
export function buildWaLink(phoneE164: string, message: string): string {
  const phone = phoneE164.replace('+', '')
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${phone}?text=${encoded}`
}

/**
 * Camada de envio abstraída.
 *
 * CAMADA 1 (padrão MVP): gera o link wa.me, retorna para o professor enviar manualmente.
 * CAMADA 2 (futuro): chama a Cloud API da Meta para envio automático.
 *
 * Se as variáveis WHATSAPP_TOKEN e WHATSAPP_PHONE_ID estiverem configuradas,
 * usa a Camada 2. Caso contrário, usa a Camada 1.
 */
export interface SendReminderResult {
  success: boolean
  channel: 'whatsapp_link' | 'whatsapp_api'
  waLink?: string
  error?: string
}

export async function sendReminder(
  student: Pick<Student, 'name' | 'phone_e164' | 'monthly_value'>,
  academy: Pick<Academy, 'name' | 'pix_key'>,
  template: string,
  dueDate: Date,
  reminderType: ReminderType
): Promise<SendReminderResult> {
  const message = buildMessage(template, student, academy, dueDate, reminderType)

  // Camada 2: WhatsApp Cloud API (se configurada)
  const waToken = process.env.WHATSAPP_TOKEN
  const waPhoneId = process.env.WHATSAPP_PHONE_ID
  const waTemplateName = process.env.WHATSAPP_TEMPLATE_NAME

  if (waToken && waPhoneId && waTemplateName) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${waPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${waToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: student.phone_e164.replace('+', ''),
            type: 'text',
            text: { body: message },
          }),
        }
      )
      if (!response.ok) {
        const err = await response.text()
        throw new Error(err)
      }
      return { success: true, channel: 'whatsapp_api' }
    } catch (err) {
      return {
        success: false,
        channel: 'whatsapp_api',
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      }
    }
  }

  // Camada 1: wa.me link (padrão MVP)
  const waLink = buildWaLink(student.phone_e164, message)
  return {
    success: true,
    channel: 'whatsapp_link',
    waLink,
  }
}
