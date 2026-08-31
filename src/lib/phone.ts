/**
 * Normaliza um número de telefone para o formato E.164 (+55DDDNNNNNNNNN)
 * Aceita: (84) 99999-9999, 84999999999, +5584999999999, etc.
 */
export function normalizePhone(raw: string): {
  e164: string | null
  error: string | null
} {
  // Remove tudo que não for dígito
  const digits = raw.replace(/\D/g, '')

  // Remove o DDI +55 se presente
  let local = digits
  if (local.startsWith('55') && local.length >= 12) {
    local = local.slice(2)
  }

  // Deve ter 10 ou 11 dígitos (DDD + número)
  if (local.length < 10 || local.length > 11) {
    return {
      e164: null,
      error: `Número inválido: esperado 10 ou 11 dígitos, recebido ${local.length}`,
    }
  }

  const ddd = parseInt(local.slice(0, 2))
  const validDDDs = [
    11, 12, 13, 14, 15, 16, 17, 18, 19, // SP
    21, 22, 24,                           // RJ
    27, 28,                               // ES
    31, 32, 33, 34, 35, 37, 38,           // MG
    41, 42, 43, 44, 45, 46,               // PR
    47, 48, 49,                           // SC
    51, 53, 54, 55,                       // RS
    61, 62, 63, 64, 65, 66, 67, 68, 69,  // CO/N
    71, 73, 74, 75, 77,                   // BA
    79,                                   // SE
    81, 82, 83, 84, 85, 86, 87, 88, 89,  // NE
    91, 92, 93, 94, 95, 96, 97, 98, 99,  // N
  ]

  if (!validDDDs.includes(ddd)) {
    return { e164: null, error: `DDD ${ddd} inválido` }
  }

  const e164 = `+55${local}`
  return { e164, error: null }
}

/**
 * Formata o telefone para exibição: (84) 99999-9999
 */
export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  const local = digits.startsWith('55') ? digits.slice(2) : digits
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  }
  return e164
}

/**
 * Máscara de telefone para input: (84) 99999-9999
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 11) {
    const separator = digits.length <= 10 ? 6 : 7
    return `(${digits.slice(0, 2)}) ${digits.slice(2, separator)}-${digits.slice(separator)}`
  }
  return value
}
