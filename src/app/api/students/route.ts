import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const { name, phone_raw, phone_e164, due_day, monthly_value, status, notes, academy_id } = body

    // Validação básica
    if (!name || !phone_e164 || !due_day || !academy_id) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('students')
      .insert({ name, phone_raw, phone_e164, due_day, monthly_value: monthly_value || null, status: status || 'active', notes: notes || null, academy_id })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
