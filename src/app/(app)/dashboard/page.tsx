import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './dashboard-client'
import { getDaysUntilDue, getDueStatus } from '@/lib/billing'
import type { Student, DashboardStats, StudentWithStatus } from '@/types'

export const metadata: Metadata = {
  title: 'Dashboard — RF Team',
}

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar perfil e academia
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, academies(*)')
    .eq('user_id', user.id)
    .single()

  // Se não tem perfil/academia ainda, redirecionar para configurações
  if (!profile) {
    redirect('/configuracoes?setup=true')
  }

  const academy = profile.academies as any
  const timezone = academy?.timezone || 'America/Fortaleza'

  // Buscar todos os alunos
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .order('name')

  const allStudents: Student[] = students || []

  // Calcular status de cada aluno
  const studentsWithStatus: StudentWithStatus[] = allStudents.map((s) => {
    if (s.status === 'inactive') {
      return { ...s, daysUntilDue: null, dueDateFormatted: null }
    }
    const days = getDaysUntilDue(s.due_day, timezone)
    const { getNextDueDate, formatDueDate } = require('@/lib/billing')
    const dueDate = getNextDueDate(s.due_day, timezone)
    return {
      ...s,
      daysUntilDue: days,
      dueDateFormatted: formatDueDate(dueDate),
    }
  })

  // Calcular estatísticas
  const activeStudents = studentsWithStatus.filter((s) => s.status === 'active')
  const stats: DashboardStats = {
    total: allStudents.length,
    active: activeStudents.length,
    onTime: activeStudents.filter((s) => (s.daysUntilDue ?? 999) > 10).length,
    dueSoon: activeStudents.filter(
      (s) => s.daysUntilDue !== null && s.daysUntilDue > 0 && s.daysUntilDue <= 10
    ).length,
    dueToday: activeStudents.filter((s) => s.daysUntilDue === 0).length,
    overdue: activeStudents.filter((s) => (s.daysUntilDue ?? 0) < 0).length,
    inactive: allStudents.filter((s) => s.status === 'inactive').length,
  }

  // Lembretes pendentes (gerados pelo cron mas não enviados ainda)
  const today = new Date().toISOString().split('T')[0]
  const { data: pendingReminders } = await supabase
    .from('reminder_logs')
    .select('*, students(name, phone_e164)')
    .eq('status', 'pending')
    .eq('scheduled_for', today)

  // Próximos vencimentos ordenados por urgência
  const upcoming = [...studentsWithStatus]
    .filter((s) => s.status === 'active')
    .sort((a, b) => {
      const da = a.daysUntilDue ?? 999
      const db = b.daysUntilDue ?? 999
      return da - db
    })
    .slice(0, 10)

  return (
    <DashboardClient
      stats={stats}
      upcoming={upcoming}
      pendingReminders={pendingReminders || []}
      academy={academy}
      studentCount={allStudents.length}
    />
  )
}
