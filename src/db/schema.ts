import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  chatId: text('chat_id').notNull(),
  username: text('username').notNull(),
  createdAt: timestamp('created_at').defaultNow()
}) 