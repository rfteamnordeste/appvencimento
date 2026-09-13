import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  getNextDueDate,
  buildCycleKey,
  DEFAULT_TEMPLATES,
  getDaysUntilDue,
} from '@/lib/billing'
import { buildMessage, buildWaLink } from '@/lib/messaging'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import type { ReminderType } from '@/types'

/**
 * POST /api/reminders/bulk
 *
 * Body: {
 *   items: Array<{
 *     studentId: string
 *     reminderType: 'd10' | 'd5' | 'd0' | 'custom'
 *     customMessage?: string   // apenas quando reminderType === 'custom'
 *   }>
 * }
 *
 * Retorna os reminder_logs criados (com wa_link calculado).
 * Idempotente: pula alunos que já têm pending/sent para o canal manual hoje.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const { items } = body as {
      items: Array<{
        studentId: string
        reminderType: ReminderType | 'custom'
        customMessage?: string
      }>
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Nenhum item fornecido' }, { status: 400 })
    }

    // Buscar academia do professor logado
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, academies(*)')
      .eq('user_id', user.id)
      .single()

    if (!profile?.academies) {
      return NextResponse.json({ error: 'Academia não encontrada' }, { status: 404 })
    }

    const academy = profile.academies as any
    const timezone = academy.timezone || 'America/Fortaleza'

    // Service client para inserir sem restrições de RLS
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const nowInTz = toZonedTime(new Date(), timezone)
    const today = format(nowInTz, 'yyyy-MM-dd')

    // Buscar templates da academia
    const { data: templates } = await serviceClient
      .from('message_templates')
      .select('*')
      .eq('academy_id', academy.id)
      .eq('active', true)

    const templateMap: Record<ReminderType, string> = {
      d10: templates?.find((t: any) => t.reminder_type === 'd10')?.content || DEFAULT_TEMPLATES.d10,
      d5: templates?.find((t: any) => t.reminder_type === 'd5')?.content || DEFAULT_TEMPLATES.d5,
      d0: templates?.find((t: any) => t.reminder_type === 'd0')?.content || DEFAULT_TEMPLATES.d0,
    }

    const created: any[] = []
    const skipped: string[] = []
    const errors: string[] = []

    for (const item of items) {
      // Buscar aluno
      const { data: student } = await serviceClient
        .from('students')
        .select('*')
        .eq('id', item.studentId)
        .eq('academy_id', academy.id)
        .single()

      if (!student) {
        errors.push(item.studentId)
        continue
      }

      if (!student.phone_e164 || !student.phone_e164.startsWith('+')) {
        errors.push(student.id)
        continue
      }

      // Verificar idempotência: já existe pending/sent com canal manual hoje?
      const { data: existing } = await serviceClient
        .from('reminder_logs')
        .select('id')
        .eq('student_id', student.id)
        .eq('scheduled_for', today)
        .eq('channel', 'whatsapp_link_manual_bulk')
        .in('status', ['pending', 'sent'])
        .maybeSingle()

      if (existing) {
        skipped.push(student.id)
        continue
      }

      // Calcular due_date e cycle_key
      const dueDate = getNextDueDate(student.due_day, timezone)
      const dueDateStr = format(dueDate, 'yyyy-MM-dd')
      const cycleKey = buildCycleKey(academy.id, student.id, dueDate)

      // Garantir billing_cycle existe
      await serviceClient.from('billing_cycles').upsert(
        { student_id: student.id, due_date: dueDateStr, cycle_key: cycleKey },
        { onConflict: 'cycle_key', ignoreDuplicates: true }
      )
      const { data: cycle } = await serviceClient
        .from('billing_cycles')
        .select('id')
        .eq('cycle_key', cycleKey)
        .single()

      // Determinar tipo e mensagem
      let resolvedType: ReminderType = 'd0'
      let messageText: string

      if (item.reminderType === 'custom' && item.customMessage) {
        resolvedType = 'd0'
        // Para mensagem livre: interpolar com daysUntilDue real do aluno
        const realDays = getDaysUntilDue(student.due_day, timezone)
        const dueDateFormatted = format(dueDate, "dd 'de' MMMM", { locale: ptBR })
        const valorStr = student.monthly_value
          ? `R$ ${student.monthly_value.toFixed(2).replace('.', ',')}`
          : ''
        messageText = item.customMessage
          .replace(/\{\{nome\}\}/g, student.name)
          .replace(/\{\{dias\}\}/g, String(Math.max(0, realDays)))
          .replace(/\{\{data_vencimento\}\}/g, dueDateFormatted)
          .replace(/\{\{valor\}\}/g, valorStr)
          .replace(/\{\{academia\}\}/g, academy.name)
          .replace(/\{\{chave_pix\}\}/g, academy.pix_key || '(configure a chave Pix)')
          .replace(/\{\{#if valor\}\}[\s\S]*?\{\{\/if\}\}/g, valorStr ? valorStr : '')
          .trim()
      } else {
        resolvedType = (item.reminderType as ReminderType) || 'd0'
        const template = templateMap[resolvedType]
        messageText = buildMessage(template, student, academy, dueDate, resolvedType)
      }

      const waLink = buildWaLink(student.phone_e164, messageText)

      const { data: log, error: insertError } = await serviceClient
        .from('reminder_logs')
        .insert({
          student_id: student.id,
          billing_cycle_id: cycle?.id || null,
          reminder_type: resolvedType,
          scheduled_for: today,
          status: 'pending',
          channel: 'whatsapp_link_manual_bulk',
          wa_link: waLink,
          message_text: messageText,
        })
        .select()
        .single()

      if (insertError) {
        errors.push(student.id)
      } else {
        created.push({ ...log, student_name: student.name, student_phone: student.phone_e164 })
      }
    }

    return NextResponse.json({
      created,
      skipped_count: skipped.length,
      error_count: errors.length,
      total_requested: items.length,
    })
  } catch (err) {
    console.error('[BULK REMINDERS] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
