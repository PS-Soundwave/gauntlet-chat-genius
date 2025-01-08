import { relations } from 'drizzle-orm'
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core'
import type { PgColumn } from 'drizzle-orm/pg-core'

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  chatId: text('chat_id').notNull(),
  username: text('username').notNull(),
  parentId: integer('parent_id').references((): PgColumn => messages.id),
  createdAt: timestamp('created_at').defaultNow()
})

export const messagesRelations = relations(messages, ({ one, many }) => ({
  parentId: one(messages, {
    fields: [messages.parentId],
    references: [messages.id]
  }),
  reactions: many(reactions)
}))

export const reactions = pgTable('reactions', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id')
    .notNull()
    .references(() => messages.id),
  username: text('username').notNull(),
  emoji: text('emoji').notNull(),
  createdAt: timestamp('created_at').defaultNow()
})

export const reactionsRelations = relations(reactions, ({ one }) => ({
  messageId: one(messages, {
    fields: [reactions.messageId],
    references: [messages.id]
  })
}))
