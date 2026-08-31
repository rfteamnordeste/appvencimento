import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const start = Date.now()
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Ping leve — SELECT 1 garante atividade real no banco
    const { data, error } = await supabase.rpc('version').single()

    const elapsed = Date.now() - start

    if (error) {
      // Fallback: tentar uma query mais simples
      const { error: e2 } = await supabase.from('academies').select('id').limit(1)
      if (e2) {
        return NextResponse.json(
          { status: 'error', message: e2.message, elapsed_ms: elapsed },
          { status: 503 }
        )
      }
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      elapsed_ms: elapsed,
      service: 'RF Team',
    })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Unknown error', elapsed_ms: Date.now() - start },
      { status: 503 }
    )
  }
}
