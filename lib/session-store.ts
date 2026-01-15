/**
 * In-memory session store for demo purposes
 * In production, use Redis, Database, or other persistent storage
 */

import type { AccessKeySession, PaymentChallenge } from '@/types'

type SessionData = {
  accessKey?: AccessKeySession
  challenges: Map<string, PaymentChallenge & { createdAt: number }>
}

// Use global singleton to ensure same store across all module instances
const globalForSessions = globalThis as unknown as {
  sessions: Map<string, SessionData> | undefined
}

if (!globalForSessions.sessions) {
  globalForSessions.sessions = new Map<string, SessionData>()
  console.log('[session-store] Global singleton initialized')
}

const sessions = globalForSessions.sessions
const STORE_ID = Math.random().toString(36).substring(7)
console.log('[session-store] Module loaded with ID:', STORE_ID)

// Session expires after 24 hours
const SESSION_EXPIRY = 24 * 60 * 60 * 1000

// Challenge expires after 5 minutes
const CHALLENGE_EXPIRY = 5 * 60 * 1000

export function getSession(address: string): SessionData {
  const key = address.toLowerCase()
  console.log(`[session-store:${STORE_ID}] getSession called for:`, key)
  console.log(`[session-store:${STORE_ID}] Total sessions:`, sessions.size)
  console.log(`[session-store:${STORE_ID}] Session keys:`, Array.from(sessions.keys()))

  let session = sessions.get(key)

  if (!session) {
    console.log(`[session-store:${STORE_ID}] Creating new session for:`, key)
    session = {
      challenges: new Map(),
    }
    sessions.set(key, session)
  }

  return session
}

export function setAccessKey(address: string, accessKey: AccessKeySession): void {
  console.log(`[session-store:${STORE_ID}] setAccessKey called for:`, address.toLowerCase())
  const session = getSession(address)
  session.accessKey = accessKey
  console.log(`[session-store:${STORE_ID}] Access key set, balance:`, accessKey.remainingBalance)
}

export function getAccessKey(address: string): AccessKeySession | undefined {
  console.log(`[session-store:${STORE_ID}] getAccessKey called for:`, address.toLowerCase())
  const session = getSession(address)
  console.log(`[session-store:${STORE_ID}] Found session with accessKey:`, !!session.accessKey)
  return session.accessKey
}

export function updateBalance(address: string, newBalance: number): void {
  const session = getSession(address)
  if (session.accessKey) {
    session.accessKey.remainingBalance = newBalance
  }
}

export function storeChallenge(address: string, challenge: PaymentChallenge): void {
  const session = getSession(address)
  session.challenges.set(challenge.id, {
    ...challenge,
    createdAt: Date.now(),
  })

  // Clean up expired challenges
  cleanupExpiredChallenges(address)
}

export function getChallenge(address: string, challengeId: string): PaymentChallenge | null {
  const session = getSession(address)
  const challenge = session.challenges.get(challengeId)

  if (!challenge) return null

  // Check if expired
  if (Date.now() - challenge.createdAt > CHALLENGE_EXPIRY) {
    session.challenges.delete(challengeId)
    return null
  }

  return challenge
}

export function deleteChallenge(address: string, challengeId: string): void {
  const session = getSession(address)
  session.challenges.delete(challengeId)
}

function cleanupExpiredChallenges(address: string): void {
  const session = getSession(address)
  const now = Date.now()

  for (const [id, challenge] of session.challenges.entries()) {
    if (now - challenge.createdAt > CHALLENGE_EXPIRY) {
      session.challenges.delete(id)
    }
  }
}

// Cleanup old sessions periodically
setInterval(() => {
  const now = Date.now()
  // This is a simple cleanup - in production use proper session management
  console.log(`Sessions in memory: ${sessions.size}`)
}, 60 * 60 * 1000) // Every hour
