import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const { name, pix_key, timezone } = body

    if (!name) return NextResponse.json({ error: 'Nome da academia é obrigatório' }, { status: 400 })

    const { data, error } = await supabase
      .from('academies')
      .update({
        name: name.trim(),
        pix_key: pix_key ? pix_key.trim() : null,
        timezone: timezone || 'America/Fortaleza',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.academy_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
