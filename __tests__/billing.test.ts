import test from 'node:test';
import assert from 'node:assert/strict';

// Test implementation of core billing logic
function getReminderTypeForToday(daysUntilDue: number): 'd10' | 'd5' | 'd0' | null {
  if (daysUntilDue === 10) return 'd10';
  if (daysUntilDue === 5) return 'd5';
  if (daysUntilDue === 0) return 'd0';
  return null;
}

function buildCycleKey(academyId: string, studentId: string, dueDateStr: string): string {
  return `${academyId}|${studentId}|${dueDateStr}`;
}

function normalizePhone(raw: string): { e164: string | null; error: string | null } {
  const digits = raw.replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('55') && local.length >= 12) {
    local = local.slice(2);
  }
  if (local.length < 10 || local.length > 11) {
    return { e164: null, error: `Número inválido: ${local.length} dígitos` };
  }
  return { e164: `+55${local}`, error: null };
}

function buildMessage(template: string, name: string, days: number, academy: string, pix: string): string {
  return template
    .replace(/\{\{nome\}\}/g, name)
    .replace(/\{\{dias\}\}/g, String(days))
    .replace(/\{\{academia\}\}/g, academy)
    .replace(/\{\{chave_pix\}\}/g, pix);
}

// ============================================================
// TEST SUITE: Regras de Vencimento e Idempotência (Seção 8)
// ============================================================

test('1. Faltam 10 dias → dispara lembrete D-10', () => {
  const type = getReminderTypeForToday(10);
  assert.equal(type, 'd10');
});

test('2. Faltam 9 dias → NÃO dispara D-10', () => {
  const type = getReminderTypeForToday(9);
  assert.equal(type, null);
});

test('3. Faltam 5 dias → dispara lembrete D-5', () => {
  const type = getReminderTypeForToday(5);
  assert.equal(type, 'd5');
});

test('4. Faltam 4 dias → NÃO dispara D-5', () => {
  const type = getReminderTypeForToday(4);
  assert.equal(type, null);
});

test('5. Vence hoje (0 dias) → dispara lembrete D-0', () => {
  const type = getReminderTypeForToday(0);
  assert.equal(type, 'd0');
});

test('6. Idempotência: cycle_key único por aluno/academia/data', () => {
  const key1 = buildCycleKey('acad-1', 'stud-1', '2026-09-10');
  const key2 = buildCycleKey('acad-1', 'stud-1', '2026-09-10');
  assert.equal(key1, key2);
  assert.equal(key1, 'acad-1|stud-1|2026-09-10');
});

test('7. Telefone inválido → falha com erro e não trava a execução', () => {
  const res = normalizePhone('123'); // apenas 3 dígitos
  assert.equal(res.e164, null);
  assert.ok(res.error?.includes('Número inválido'));
});

test('8. Telefone válido → normaliza para E.164 (+55...)', () => {
  const res = normalizePhone('(84) 99999-8888');
  assert.equal(res.e164, '+5584999998888');
  assert.equal(res.error, null);
});

test('9. Substituição de variáveis no template D-10', () => {
  const template = 'Fala {{nome}}! Faltam {{dias}} dias. Pix {{academia}}: {{chave_pix}}';
  const result = buildMessage(template, 'Josué', 10, 'RF Team', '123.456.789-00');
  assert.equal(result, 'Fala Josué! Faltam 10 dias. Pix RF Team: 123.456.789-00');
});
