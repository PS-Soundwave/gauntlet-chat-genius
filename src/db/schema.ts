import { relations, sql } from 'drizzle-orm'
import { pgTable, text, timestamp, integer, primaryKey, serial, pgEnum, check, foreignKey, unique } from 'drizzle-orm/pg-core'
import type { PgColumn } from 'drizzle-orm/pg-core'

export const messageTypeEnum = pgEnum('message_type', ['message', 'direct_message'])

export const messageIds = pgTable('message_ids', {
  id: serial('id').primaryKey(),
  type: messageTypeEnum('type').notNull()
}, (table) => [unique().on(table.id, table.type)])

export const messageContents = pgTable('message_contents', {
  id: serial('id').primaryKey(),
  content: text('content').notNull()
})

export const messageContentsRelations = relations(messageContents, ({ many }) => ({
  reactions: many(reactions),
  attachments: many(attachments)
}))

export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  name: text('name').notNull()
})

export const messages = pgTable('messages', {
  id: integer('id').primaryKey(),
  type: messageTypeEnum().notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  contentId: integer('content_id')
    .notNull()
    .references(() => messageContents.id),
  channelId: integer('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id').references((): PgColumn => messages.id),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => [
  check("type", sql`type = 'message'`),
  foreignKey({
    columns: [table.id, table.type],
    foreignColumns: [messageIds.id, messageIds.type]
  })
])

export const channelsRelations = relations(channels, ({ many }) => ({
  messages: many(messages)
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.clerkId]
  }),
  messageContent: one(messageContents, {
    fields: [messages.contentId],
    references: [messageContents.id]
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id]
  }),
  parentMessage: one(messages, {
    fields: [messages.parentId],
    references: [messages.id]
  }),
  replies: many(messages),
  id: one(messageIds, {
    fields: [messages.id],
    references: [messageIds.id]
  })
}))

export const reactions = pgTable('reactions', {
  messageId: integer('message_id')
    .notNull()
    .references(() => messageContents.id),
  username: text('username').notNull(),
  emoji: text('emoji').notNull(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => [primaryKey({ columns: [table.messageId, table.username, table.emoji] })])

export const reactionsRelations = relations(reactions, ({ one }) => ({
  message: one(messageContents, {
    fields: [reactions.messageId],
    references: [messageContents.id]
  }),
  user: one(users, {
    fields: [reactions.username],
    references: [users.clerkId]
  })
}))

export const directMessages = pgTable('direct_messages', {
  id: integer('id').primaryKey(),
  type: messageTypeEnum('type').notNull(),
  contentId: integer('content_id')
    .notNull()
    .references(() => messageContents.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  participant1: text('participant1').notNull(),
  participant2: text('participant2').notNull(),
  parentId: integer('parent_id').references((): PgColumn => directMessages.id),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => [check("type", sql`type = 'direct_message'`), foreignKey({ columns: [table.id, table.type], foreignColumns: [messageIds.id, messageIds.type] })])

export const directMessagesRelations = relations(directMessages, ({ one, many }) => ({
  user: one(users, {
    fields: [directMessages.userId],
    references: [users.clerkId]
  }),
  messageContent: one(messageContents, {
    fields: [directMessages.contentId],
    references: [messageContents.id]
  }),
  parentMessage: one(directMessages, {
    fields: [directMessages.parentId],
    references: [directMessages.id]
  }),
  replies: many(directMessages),
  id: one(messageIds, {
    fields: [directMessages.id],
    references: [messageIds.id]
  })
}))

export const attachments = pgTable('attachments', {
  id: serial('id').primaryKey(),
  messageContentId: integer('message_content_id')
    .notNull()
    .references(() => messageContents.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull()
})

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  messageContent: one(messageContents, {
    fields: [attachments.messageContentId],
    references: [messageContents.id]
  })
}))

export const users = pgTable('users', {
  clerkId: text('clerk_id').notNull().primaryKey(),
  username: text('username').notNull().unique(),
})

export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
  reactions: many(reactions),
  directMessages: many(directMessages)
}))
