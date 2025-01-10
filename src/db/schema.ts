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
  content: text('content').notNull(),
  username: text('username').notNull(),
})

export const messageContentsRelations = relations(messageContents, ({ one, many }) => ({
  reactions: many(reactions)
}))

export const messages = pgTable('messages', {
  id: integer('id')
    .primaryKey(),
  type: messageTypeEnum().notNull(),
  contentId: integer('content_id')
    .notNull()
    .references(() => messageContents.id),
  chatId: text('chat_id').notNull(),
  parentId: integer('parent_id').references((): PgColumn => messages.id),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => [check("type", sql`type = 'message'`), foreignKey({ columns: [table.id, table.type], foreignColumns: [messageIds.id, messageIds.type] })])

export const messagesRelations = relations(messages, ({ one, many }) => ({
  messageContent: one(messageContents, {
    fields: [messages.contentId],
    references: [messageContents.id]
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
  })
}))

export const directMessages = pgTable('direct_messages', {
  id: integer('id').primaryKey(),
  type: messageTypeEnum('type').notNull(),
  contentId: integer('content_id')
    .notNull()
    .references(() => messageContents.id),
  participant1: text('participant1').notNull(),
  participant2: text('participant2').notNull(),
  parentId: integer('parent_id').references((): PgColumn => directMessages.id),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => [check("type", sql`type = 'direct_message'`), foreignKey({ columns: [table.id, table.type], foreignColumns: [messageIds.id, messageIds.type] })])

export const directMessagesRelations = relations(directMessages, ({ one, many }) => ({
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
