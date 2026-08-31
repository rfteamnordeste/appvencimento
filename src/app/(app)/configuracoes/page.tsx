import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfiguracoesClient from './configuracoes-client'

export const metadata: Metadata = { title: 'Configurações — RF Team' }

export const revalidate = 0

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, academies(*)')
    .eq('user_id', user.id)
    .single()

  const academy = profile?.academies as any

  return <ConfiguracoesClient academy={academy || null} profile={profile || null} userEmail={user.email || ''} />
}
