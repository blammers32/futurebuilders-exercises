const ACCOUNTS = 'fb-desk-accounts'
const SESSION = 'fb-demo-session'

type Account = { name: string; passHash: string; rooms: { code: string; title: string }[] }

async function digest(name: string, passphrase: string) {
  const bytes = new TextEncoder().encode(`${name.trim().toLowerCase()}::${passphrase}`)
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function accounts(): Record<string, Account> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS) || '{}') as Record<string, Account>
  } catch {
    return {}
  }
}

function saveAccounts(next: Record<string, Account>) {
  localStorage.setItem(ACCOUNTS, JSON.stringify(next))
}

function remember(name: string) {
  sessionStorage.setItem(SESSION, JSON.stringify({ name }))
  window.dispatchEvent(new Event('fb-desk'))
}

export function demoSession(): { name: string } | null {
  const raw = sessionStorage.getItem(SESSION)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { name?: string }
    return parsed.name ? { name: parsed.name } : null
  } catch {
    return null
  }
}

export async function createDemoDesk(name: string, passphrase: string) {
  const clean = name.trim()
  if (clean.length < 2) throw new Error('Use a name students would recognize.')
  if (passphrase.length < 4) throw new Error('Use at least 4 characters.')
  const key = clean.toLowerCase()
  const all = accounts()
  if (all[key]) throw new Error('That desk already exists on this computer. Sign in.')
  all[key] = { name: clean, passHash: await digest(clean, passphrase), rooms: [] }
  saveAccounts(all)
  remember(clean)
  return { name: clean }
}

export async function enterDemoDesk(name: string, passphrase: string) {
  const clean = name.trim()
  const account = accounts()[clean.toLowerCase()]
  if (!account || account.passHash !== (await digest(clean, passphrase))) {
    throw new Error('Name or passphrase did not match.')
  }
  sessionStorage.setItem(SESSION, JSON.stringify({ name: account.name }))
  window.dispatchEvent(new Event('fb-desk'))
  return { name: account.name }
}

export function leaveDemoDesk() {
  sessionStorage.removeItem(SESSION)
  window.dispatchEvent(new Event('fb-desk'))
}

export function demoRooms() {
  const session = demoSession()
  if (!session) return []
  return accounts()[session.name.toLowerCase()]?.rooms ?? []
}

export function rememberDemoRoom(code: string, title: string) {
  const session = demoSession()
  if (!session) return
  const all = accounts()
  const account = all[session.name.toLowerCase()]
  if (!account) return
  account.rooms = [{ code, title }, ...account.rooms.filter((room) => room.code !== code)]
  saveAccounts(all)
}
