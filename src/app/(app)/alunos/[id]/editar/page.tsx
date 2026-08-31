import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import StudentForm from '../../student-form'

export const metadata: Metadata = { title: 'Editar Aluno — RF Team' }

export default async function EditarAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (!student) notFound()

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Editar aluno
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          {student.name}
        </p>
      </div>
      <StudentForm student={student} academyId={academy?.id || ''} />
    </div>
  )
}
