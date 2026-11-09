// Utilitários de senha — hash com Web Crypto (SHA-256 + salt aleatório).
// Formato armazenado: "sha256$<saltHex>$<hashHex>"
// Compatível com senhas antigas em texto plano (verificação legada + upgrade).
const PREFIX = 'sha256$'

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

// Já está no formato hasheado?
export function isHashedPassword(value) {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

// Gera o hash de uma senha em texto plano.
export async function hashPassword(plain) {
  const salt = randomSalt()
  const hash = await sha256Hex(`${salt}:${String(plain ?? '')}`)
  return `${PREFIX}${salt}$${hash}`
}

// Verifica uma senha contra o valor armazenado (hasheado ou texto plano legado).
export async function verifyPassword(plain, stored) {
  const value = String(stored ?? '')
  if (!isHashedPassword(value)) {
    // Legado: senha em texto plano
    return value === String(plain ?? '')
  }
  const parts = value.split('$')
  const salt = parts[1]
  const hash = parts[2]
  if (!salt || !hash) return false
  const calc = await sha256Hex(`${salt}:${String(plain ?? '')}`)
  return calc === hash
}
