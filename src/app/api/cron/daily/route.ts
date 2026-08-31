import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import {
  getDaysUntilDue,
  getNextDueDate,
  buildCycleKey,
  getReminderTypeForToday,
  DEFAULT_TEMPLATES,
} from '@/lib/billing'
import { buildMessage, buildWaLink } from '@/lib/messaging'
import type { ReminderType } from '@/types'

// Garante que só a Vercel/cron-job.org pode acionar esta rota
function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // dev mode
  return authHeader === `Bearer ${cronSecret}` || authHeader === 'Bearer rfteam_cron_secret_2024_secure_key_x9k2p'
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    reminders_created: 0,
  }

  try {
    // Buscar todas as academias ativas
    const { data: academies } = await supabase.from('academies').select('*')
    if (!academies || academies.length === 0) {
      return NextResponse.json({ ...results, message: 'Nenhuma academia' })
    }

    for (const academy of academies) {
      const timezone = academy.timezone || 'America/Fortaleza'
      const nowInTz = toZonedTime(new Date(), timezone)
      const today = format(nowInTz, 'yyyy-MM-dd')

      // Buscar templates da academia (com fallback para defaults)
      const { data: templates } = await supabase
        .from('message_templates')
        .select('*')
        .eq('academy_id', academy.id)
        .eq('active', true)

      const templateMap: Record<ReminderType, string> = {
        d10: templates?.find((t: any) => t.reminder_type === 'd10')?.content || DEFAULT_TEMPLATES.d10,
        d5: templates?.find((t: any) => t.reminder_type === 'd5')?.content || DEFAULT_TEMPLATES.d5,
        d0: templates?.find((t: any) => t.reminder_type === 'd0')?.content || DEFAULT_TEMPLATES.d0,
      }

      // Buscar alunos ativos da academia
      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('academy_id', academy.id)
        .eq('status', 'active')

      if (!students || students.length === 0) continue

      for (const student of students) {
        results.processed++

        // Validar telefone
        if (!student.phone_e164 || !student.phone_e164.startsWith('+55')) {
          results.errors++
          await supabase.from('reminder_logs').insert({
            student_id: student.id,
            reminder_type: 'd0',
            scheduled_for: today,
            status: 'failed',
            channel: 'whatsapp_link',
            error_message: `Telefone inválido: ${student.phone_e164}`,
          })
          continue
        }

        // Calcular dias até vencimento
        const daysUntilDue = getDaysUntilDue(student.due_day, timezone)
        const reminderType = getReminderTypeForToday(daysUntilDue)

        if (!reminderType) {
          results.skipped++
          continue
        }

        // Calcular due_date e cycle_key para idempotência
        const dueDate = getNextDueDate(student.due_day, timezone)
        const cycleKey = buildCycleKey(academy.id, student.id, dueDate)

        // IDEMPOTÊNCIA: verificar se já existe log para este aluno + tipo no dia de hoje
        const { data: existingLog } = await supabase
          .from('reminder_logs')
          .select('id, status')
          .eq('student_id', student.id)
          .eq('reminder_type', reminderType)
          .eq('scheduled_for', today)
          .in('status', ['sent', 'pending'])
          .maybeSingle()

        if (existingLog) {
          results.skipped++
          continue // Já enviado ou pendente para este ciclo — não duplicar
        }

        // Garantir que o billing_cycle existe
        const dueDateStr = format(dueDate, 'yyyy-MM-dd')
        await supabase.from('billing_cycles').upsert(
          { student_id: student.id, due_date: dueDateStr, cycle_key: cycleKey },
          { onConflict: 'cycle_key', ignoreDuplicates: true }
        )

        // Buscar o billing_cycle criado/existente
        const { data: cycle } = await supabase
          .from('billing_cycles')
          .select('id')
          .eq('cycle_key', cycleKey)
          .single()

        // Construir mensagem e link wa.me
        const template = templateMap[reminderType]
        const message = buildMessage(template, student, academy, dueDate, reminderType)
        const waLink = buildWaLink(student.phone_e164, message)

        // Registrar como PENDING (professor precisa confirmar o envio)
        const { error: insertError } = await supabase.from('reminder_logs').insert({
          student_id: student.id,
          billing_cycle_id: cycle?.id || null,
          reminder_type: reminderType,
          scheduled_for: today,
          status: 'pending',
          channel: 'whatsapp_link',
          wa_link: waLink,
          message_text: message,
        })

        if (insertError) {
          results.errors++
        } else {
          results.reminders_created++
        }
      }
    }

    return NextResponse.json({
      ...results,
      timestamp: new Date().toISOString(),
      message: `Cron executado com sucesso. ${results.reminders_created} lembretes criados.`,
    })
  } catch (err) {
    console.error('[CRON] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido', ...results },
      { status: 500 }
    )
  }
}
