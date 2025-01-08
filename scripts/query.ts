import { eq, asc } from "drizzle-orm";
import { messages } from "../src/db/schema";
import { db } from "@/db";

console.log(db.query.messages.findMany({
    columns: {
      id: true,
      content: true,
      username: true,
      createdAt: true,
      parentId: true
    },
    where: eq(messages.chatId, `channel-test`),
    with: {
      reactions: {
        columns: {
          emoji: true,
          username: true
        }
      }
    },
    orderBy: asc(messages.createdAt)
  }).toSQL());