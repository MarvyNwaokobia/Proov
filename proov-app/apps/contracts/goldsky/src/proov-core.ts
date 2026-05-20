import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  HabitCreated,
  HabitCompleted,
  HabitDeactivated,
  StreakUpdated,
  StreakBroken,
  MilestoneReached,
} from '../generated/ProovCore/ProovCore'
import { User, Habit, HabitCompletion, Milestone } from '../generated/schema'

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

export function handleHabitCreated(event: HabitCreated): void {
  const user = getOrCreateUser(event.params.user, event.block.timestamp)

  const habitId = user.id + '-' + event.params.habitId.toString()
  const habit = new Habit(habitId)
  habit.habitId = event.params.habitId
  habit.user = user.id
  habit.name = event.params.name
  habit.active = true
  habit.currentStreak = 0
  habit.totalCompletions = 0
  habit.createdAt = event.block.timestamp
  habit.save()
}

export function handleHabitCompleted(event: HabitCompleted): void {
  const user = getOrCreateUser(event.params.user, event.block.timestamp)

  const habitId = user.id + '-' + event.params.habitId.toString()
  const habit = Habit.load(habitId)
  if (habit) {
    habit.currentStreak = event.params.streak.toI32()
    habit.totalCompletions = habit.totalCompletions + 1
    habit.save()
  }

  const completionId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const completion = new HabitCompletion(completionId)
  completion.user = user.id
  completion.habit = habitId
  completion.streak = event.params.streak
  completion.timestamp = event.block.timestamp
  completion.txHash = event.transaction.hash.toHexString()
  completion.save()

  user.totalCompletions = user.totalCompletions + 1
  user.lastActiveAt = event.block.timestamp
  user.save()
}

export function handleHabitDeactivated(event: HabitDeactivated): void {
  const userId = event.params.user.toHexString()
  const habitId = userId + '-' + event.params.habitId.toString()
  const habit = Habit.load(habitId)
  if (habit) {
    habit.active = false
    habit.save()
  }
}

export function handleStreakUpdated(event: StreakUpdated): void {
  const user = getOrCreateUser(event.params.user, event.block.timestamp)
  user.currentStreak = event.params.newStreak.toI32()
  user.longestStreak = event.params.longestStreak.toI32()
  user.lastActiveAt = event.block.timestamp
  user.save()
}

export function handleStreakBroken(event: StreakBroken): void {
  const user = getOrCreateUser(event.params.user, event.block.timestamp)
  user.currentStreak = 0
  user.lastActiveAt = event.block.timestamp
  user.save()
}

export function handleMilestoneReached(event: MilestoneReached): void {
  const user = getOrCreateUser(event.params.user, event.block.timestamp)

  const milestoneId = user.id + '-' + event.params.milestone.toString()
  const milestone = new Milestone(milestoneId)
  milestone.user = user.id
  milestone.milestone = event.params.milestone
  milestone.timestamp = event.block.timestamp
  milestone.save()
}
