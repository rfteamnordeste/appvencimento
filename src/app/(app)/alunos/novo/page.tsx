import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentForm from '../student-form'

export const metadata: Metadata = { title: 'Novo Aluno — RF Team' }

export default async function NovoAlunoPage() {
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

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Novo aluno
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Preencha os dados do aluno. Campos com * são obrigatórios.
        </p>
      </div>
      <StudentForm academyId={academy?.id || ''} />
    </div>
  )
}
