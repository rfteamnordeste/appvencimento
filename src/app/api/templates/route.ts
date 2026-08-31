import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('academy_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

    const { data: templates } = await supabase
      .from('message_templates')
      .select('*')
      .eq('academy_id', profile.academy_id)

    return NextResponse.json(templates || [])
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('academy_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

    const body = await request.json()
    const { reminder_type, content, active } = body

    if (!reminder_type || !content) {
      return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('message_templates')
      .upsert(
        {
          academy_id: profile.academy_id,
          reminder_type,
          content,
          active: active !== undefined ? active : true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'academy_id,reminder_type' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
