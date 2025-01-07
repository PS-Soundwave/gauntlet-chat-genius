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