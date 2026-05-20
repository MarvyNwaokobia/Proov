import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  SessionStarted,
  SessionCompleted,
  SessionAbandoned,
} from '../generated/SessionManager/SessionManager'
import { Session, User } from '../generated/schema'

function getOrCreateUser(address: Bytes, timestamp: BigInt): User {
  const id = address.toHexString()
  let user = User.load(id)
  if (!user) {
    user = new User(id)
    user.address = address
    user.currentStreak = 0
    user.longestStreak = 0
    user.totalCompletions = 0
    user.totalSessions = 0
    user.cheersReceived = 0
    user.cheersSent = 0
    user.lastActiveAt = timestamp
    user.createdAt = timestamp
    user.save()
  }
  return user
}

export function handleSessionStarted(event: SessionStarted): void {
  const user = getOrCreateUser(event.params.user, event.block.timestamp)

  const sessionId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const session = new Session(sessionId)
  session.user = user.id
  session.habitId = event.params.habitId
  session.startTime = event.params.startTimestamp
  session.status = 'active'
  session.save()

  user.totalSessions = user.totalSessions + 1
  user.lastActiveAt = event.block.timestamp
  user.save()
}

export function handleSessionCompleted(event: SessionCompleted): void {
  const sessionId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const session = new Session(sessionId)
  session.user = event.params.user.toHexString()
  session.habitId = event.params.habitId
  session.startTime = event.block.timestamp
  session.duration = event.params.duration
  session.status = 'completed'
  session.save()
}

export function handleSessionAbandoned(event: SessionAbandoned): void {
  const sessionId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const session = new Session(sessionId)
  session.user = event.params.user.toHexString()
  session.habitId = event.params.habitId
  session.startTime = event.block.timestamp
  session.duration = event.params.duration
  session.status = 'abandoned'
  session.save()
}
