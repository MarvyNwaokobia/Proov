import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  MemberAdded,
  CheerSent,
  RemovedFromCircle,
} from '../generated/CircleManager/CircleManager'
import { CircleConnection, Cheer, User } from '../generated/schema'

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

export function handleMemberAdded(event: MemberAdded): void {
  const id = event.params.circleOwner.toHexString() + '-' + event.params.member.toHexString()
  const connection = new CircleConnection(id)
  connection.owner = event.params.circleOwner.toHexString()
  connection.member = event.params.member
  connection.createdAt = event.params.timestamp
  connection.active = true
  connection.save()
}

export function handleCheerSent(event: CheerSent): void {
  const from = getOrCreateUser(event.params.from, event.block.timestamp)
  const to = getOrCreateUser(event.params.to, event.block.timestamp)

  const cheerId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const cheer = new Cheer(cheerId)
  cheer.from = event.params.from
  cheer.to = event.params.to
  cheer.timestamp = event.params.timestamp
  cheer.save()

  from.cheersSent = from.cheersSent + 1
  from.save()

  to.cheersReceived = to.cheersReceived + 1
  to.save()
}

export function handleRemovedFromCircle(event: RemovedFromCircle): void {
  const id = event.params.user.toHexString() + '-' + event.params.removed.toHexString()
  const connection = CircleConnection.load(id)
  if (connection) {
    connection.active = false
    connection.save()
  }
}
