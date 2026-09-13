import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DisparoClient from './disparo-client'
import { getDaysUntilDue, getNextDueDate, formatDueDate } from '@/lib/billing'
import type { Student, StudentWithStatus, MessageTemplate } from '@/types'

export const metadata: Metadata = {
  title: 'Disparo Manual — RF Team',
}

export const revalidate = 0

export default async function DisparoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, academies(*)')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/configuracoes?setup=true')

  const academy = profile.academies as any
  const timezone = academy?.timezone || 'America/Fortaleza'

  // Buscar alunos ativos
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('academy_id', academy.id)
    .order('name')

  const allStudents: Student[] = students || []

  const studentsWithStatus: StudentWithStatus[] = allStudents.map((s) => {
    if (s.status === 'inactive') {
      return { ...s, daysUntilDue: null, dueDateFormatted: null }
    }
    const days = getDaysUntilDue(s.due_day, timezone)
    const dueDate = getNextDueDate(s.due_day, timezone)
    return {
      ...s,
      daysUntilDue: days,
      dueDateFormatted: formatDueDate(dueDate),
    }
  })

  // Ordenar: urgência primeiro
  const sorted = [...studentsWithStatus].sort((a, b) => {
    if (a.status === 'inactive' && b.status !== 'inactive') return 1
    if (a.status !== 'inactive' && b.status === 'inactive') return -1
    const da = a.daysUntilDue ?? 999
    const db = b.daysUntilDue ?? 999
    if (da < 0 && db >= 0) return -1
    if (db < 0 && da >= 0) return 1
    return da - db
  })

  // Buscar templates de mensagem da academia
  const { data: templates } = await supabase
    .from('message_templates')
    .select('*')
    .eq('academy_id', academy.id)
    .eq('active', true)

  return (
    <DisparoClient
      students={sorted}
      academy={academy}
      templates={(templates || []) as MessageTemplate[]}
    />
  )
}
