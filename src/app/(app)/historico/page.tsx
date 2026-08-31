import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatPhoneDisplay } from '@/lib/phone'

export const metadata: Metadata = { title: 'Histórico — RF Team' }

export const revalidate = 0

export default async function HistoricoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: logs } = await supabase
    .from('reminder_logs')
    .select('*, students(name, phone_e164)')
    .order('created_at', { ascending: false })
    .limit(50)

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
    d10: 'D-10 (10d antes)',
    d5: 'D-5 (5d antes)',
    d0: 'D-0 (Hoje)',
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Histórico de Envio
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Confira o registro de todos os lembretes gerados e enviados pelo sistema.
        </p>
      </div>

      {(!logs || logs.length === 0) ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">Nenhum registro no histórico</div>
          <p className="empty-state-desc">Os logs de envio de mensagens aparecerão aqui assim que forem disparados.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {logs.map((log: any) => (
            <div key={log.id} className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
                    {log.students?.name || 'Aluno'}
                  </div>
                  {log.students?.phone_e164 && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {formatPhoneDisplay(log.students.phone_e164)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {typeLabels[log.reminder_type]}
                  </span>
                  <span className={`badge ${statusColors[log.status]}`}>{statusLabels[log.status]}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
                <span>Agendado para {log.scheduled_for} · {new Date(log.created_at).toLocaleString('pt-BR')}</span>
                {log.wa_link && log.status !== 'sent' && (
                  <a href={log.wa_link} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm" id={`hist-wa-${log.id}`}>
                    Abrir WhatsApp
                  </a>
                )}
              </div>

              {log.error_message && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', padding: '6px 10px', borderRadius: '4px' }}>
                  ⚠ Erro: {log.error_message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
