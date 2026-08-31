import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getDaysUntilDue, getDueStatus, getDueStatusLabel, getNextDueDate, formatDueDate } from '@/lib/billing'
import { formatPhoneDisplay } from '@/lib/phone'
import { buildWaLink } from '@/lib/messaging'

export const metadata: Metadata = { title: 'Aluno — RF Team' }

export const revalidate = 0

export default async function AlunoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, academies(*)')
    .eq('user_id', user.id)
    .single()

  const academy = profile?.academies as any
  const timezone = academy?.timezone || 'America/Fortaleza'

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (!student) notFound()

  const { data: logs } = await supabase
    .from('reminder_logs')
    .select('*')
    .eq('student_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const days = student.status === 'active' ? getDaysUntilDue(student.due_day, timezone) : null
  const status = getDueStatus(days)
  const statusLabel = getDueStatusLabel(status, days ?? undefined)
  const dueDate = student.status === 'active' ? getNextDueDate(student.due_day, timezone) : null

  const badgeClass =
    status === 'overdue' || status === 'due_today' ? 'badge-danger' :
    status === 'due_soon' ? 'badge-warning' :
    status === 'inactive' ? 'badge-neutral' : 'badge-success'

  const statusColors: Record<string, string> = {
    pending: 'badge-warning',
    sent: 'badge-success',
    failed: 'badge-danger',
  }
  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    sent: 'Enviado',
    failed: 'Falhou',
  }
  const typeLabels: Record<string, string> = {
    d10: 'D-10',
    d5: 'D-5',
    d0: 'D-0',
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-6)' }}>
        <div>
          <Link href="/alunos" style={{ fontSize:'var(--font-size-sm)', color:'var(--color-text-secondary)' }}>
            ← Alunos
          </Link>
          <h1 style={{ fontSize:'var(--font-size-2xl)', fontWeight:800, letterSpacing:'-0.03em', marginTop:'var(--space-2)' }}>
            {student.name}
          </h1>
        </div>
        <Link href={`/alunos/${id}/editar`} className="btn btn-secondary" id={`edit-student-detail-${id}`}>
          Editar
        </Link>
      </div>

      {/* Info card */}
      <div className="card" style={{ marginBottom:'var(--space-6)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'var(--space-4)' }}>
          <div>
            <div style={{ fontSize:'var(--font-size-xs)', color:'var(--color-text-muted)', marginBottom:2 }}>Status</div>
            <span className={`badge ${badgeClass}`}>{statusLabel}</span>
          </div>
          <div>
            <div style={{ fontSize:'var(--font-size-xs)', color:'var(--color-text-muted)', marginBottom:2 }}>WhatsApp</div>
            <div style={{ fontSize:'var(--font-size-sm)', fontWeight:500 }}>{formatPhoneDisplay(student.phone_e164)}</div>
          </div>
          <div>
            <div style={{ fontSize:'var(--font-size-xs)', color:'var(--color-text-muted)', marginBottom:2 }}>Vencimento</div>
            <div style={{ fontSize:'var(--font-size-sm)', fontWeight:500 }}>Dia {student.due_day}</div>
          </div>
          {dueDate && (
            <div>
              <div style={{ fontSize:'var(--font-size-xs)', color:'var(--color-text-muted)', marginBottom:2 }}>Próximo venc.</div>
              <div style={{ fontSize:'var(--font-size-sm)', fontWeight:500 }}>{formatDueDate(dueDate)}</div>
            </div>
          )}
          {student.monthly_value && (
            <div>
              <div style={{ fontSize:'var(--font-size-xs)', color:'var(--color-text-muted)', marginBottom:2 }}>Valor</div>
              <div style={{ fontSize:'var(--font-size-sm)', fontWeight:500 }}>
                R$ {Number(student.monthly_value).toFixed(2).replace('.', ',')}
              </div>
            </div>
          )}
          {student.notes && (
            <div style={{ gridColumn:'1 / -1' }}>
              <div style={{ fontSize:'var(--font-size-xs)', color:'var(--color-text-muted)', marginBottom:2 }}>Observações</div>
              <div style={{ fontSize:'var(--font-size-sm)', color:'var(--color-text-secondary)' }}>{student.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Histórico de lembretes */}
      <section>
        <h2 style={{ fontSize:'var(--font-size-md)', fontWeight:700, marginBottom:'var(--space-4)' }}>
          Histórico de lembretes
        </h2>
        {(!logs || logs.length === 0) ? (
          <div className="empty-state" style={{ padding:'var(--space-8) 0' }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">Nenhum lembrete enviado</div>
            <p className="empty-state-desc">O histórico aparecerá aqui quando os lembretes forem gerados.</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
            {logs.map((log: any) => (
              <div key={log.id} className="card card-sm" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'var(--space-4)' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'var(--space-2)', marginBottom:2 }}>
                    <span style={{ fontSize:'var(--font-size-xs)', fontWeight:700 }}>{typeLabels[log.reminder_type]}</span>
                    <span className={`badge ${statusColors[log.status]}`}>{statusLabels[log.status]}</span>
                  </div>
                  <div style={{ fontSize:'var(--font-size-xs)', color:'var(--color-text-muted)' }}>
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                    {log.error_message && <> · <span style={{color:'var(--color-danger)'}}>{log.error_message}</span></>}
                  </div>
                </div>
                {log.wa_link && log.status !== 'sent' && (
                  <a href={log.wa_link} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm" id={`open-wa-${log.id}`}>
                    Abrir WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
