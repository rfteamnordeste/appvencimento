import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AlunosClient from './alunos-client'
import { getDaysUntilDue, getDueStatus } from '@/lib/billing'
import type { Student, StudentWithStatus } from '@/types'

export const metadata: Metadata = {
  title: 'Alunos — RF Team',
}

export const revalidate = 0

export default async function AlunosPage() {
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

  const { data: students } = await supabase
    .from('students')
    .select('*')
    .order('name')

  const allStudents: Student[] = students || []

  const studentsWithStatus: StudentWithStatus[] = allStudents.map((s) => {
    if (s.status === 'inactive') {
      return { ...s, daysUntilDue: null, dueDateFormatted: null }
    }
    const { getDaysUntilDue: getDays, getNextDueDate, formatDueDate } = require('@/lib/billing')
    const days = getDays(s.due_day, timezone)
    const dueDate = getNextDueDate(s.due_day, timezone)
    return { ...s, daysUntilDue: days, dueDateFormatted: formatDueDate(dueDate) }
  })

  // Ordenar: vence hoje → mais próximos → vencidos → em dia → inativos
  const sorted = [...studentsWithStatus].sort((a, b) => {
    if (a.status === 'inactive' && b.status !== 'inactive') return 1
    if (a.status !== 'inactive' && b.status === 'inactive') return -1
    const da = a.daysUntilDue ?? 999
    const db = b.daysUntilDue ?? 999
    // Vencidos (negativos) primeiro, então por proximidade
    if (da < 0 && db >= 0) return -1
    if (db < 0 && da >= 0) return 1
    return da - db
  })

  return <AlunosClient students={sorted} academyId={academy?.id || ''} />
}
