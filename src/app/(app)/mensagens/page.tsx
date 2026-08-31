import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MensagensClient from './mensagens-client'
import { DEFAULT_TEMPLATES } from '@/lib/billing'
import type { MessageTemplate, ReminderType } from '@/types'

export const metadata: Metadata = { title: 'Mensagens — RF Team' }

export const revalidate = 0

export default async function MensagensPage() {
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

  const { data: dbTemplates } = await supabase
    .from('message_templates')
    .select('*')
    .eq('academy_id', academy.id)

  // Preencher templates existentes ou padrão
  const types: ReminderType[] = ['d10', 'd5', 'd0']
  const templates: Record<ReminderType, { content: string; active: boolean }> = {
    d10: { content: DEFAULT_TEMPLATES.d10, active: true },
    d5: { content: DEFAULT_TEMPLATES.d5, active: true },
    d0: { content: DEFAULT_TEMPLATES.d0, active: true },
  }

  if (dbTemplates) {
    dbTemplates.forEach((t: MessageTemplate) => {
      if (t.reminder_type in templates) {
        templates[t.reminder_type] = { content: t.content, active: t.active }
      }
    })
  }

  return <MensagensClient initialTemplates={templates} academy={academy} />
}
