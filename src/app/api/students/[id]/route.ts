import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const { name, phone_raw, phone_e164, due_day, monthly_value, status, notes } = body

    if (!name || !phone_e164 || !due_day) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('students')
      .update({ name, phone_raw, phone_e164, due_day, monthly_value: monthly_value || null, status, notes: notes || null })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
