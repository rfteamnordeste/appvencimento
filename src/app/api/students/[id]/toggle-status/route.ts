import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const { currentStatus } = body

    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

    const { data, error } = await supabase
      .from('students')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
