import { Server as SocketIOServer } from "socket.io"
import { NextRequest } from "next/server"
import { db } from '@/db'
import { messages } from '@/db/schema'
import { eq, lt, desc, and, or, gt, asc } from 'drizzle-orm'

interface CustomGlobal {
  io?: SocketIOServer
}

declare global {
  var socketServer: CustomGlobal
}

if (!global.socketServer) {
  global.socketServer = {}
}

const MESSAGES_PER_PAGE = 50

export async function GET(req: NextRequest) {
  if (global.socketServer.io) {
    console.log("Socket is already running")
  } else {
    console.log("Socket is initializing")
    global.socketServer.io = new SocketIOServer(3001, {
      cors: { origin: "*" },
      transports: ['websocket'],
      allowUpgrades: false
    })

    global.socketServer.io.on("connection", (socket) => {
      console.log("Client connected")
      
      socket.on("join-chat", async (data: { 
        chatId: string
      }) => {
        console.log("Received join-chat:", data)
        socket.join(data.chatId)
      
        const chatMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.chatId, data.chatId))
            .orderBy(asc(messages.createdAt))
      
        console.log("fetched ", chatMessages.length, " messages")

        socket.emit("chat-history", {
          chatId: data.chatId,
          messages: chatMessages.map(msg => ({
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt
          }))
        })
      })

      socket.on("leave-chat", (chatId: string) => {
        socket.leave(chatId)
      })

      socket.on("send-message", async (message: { chatId: string, content: string }) => {
        await db.insert(messages).values({
          chatId: message.chatId,
          content: message.content
        })
        
        global.socketServer.io?.emit("new-message", message)
      })

      socket.on("chat-history-back", async (data: { chatId: string, cursor: { date: string, id: number } }) => {
        console.log("Received chat-history-back:", data)

        const chatMessages = await db
            .select()
            .from(messages)
            .where(and(
                eq(messages.chatId, data.chatId),
                or(
                  lt(messages.createdAt, new Date(data.cursor.date)),
                  and(
                    eq(messages.createdAt, new Date(data.cursor.date)),
                    lt(messages.id, data.cursor.id)
                  )
                )
              ))
            .orderBy(desc(messages.createdAt), desc(messages.id))
            .limit(MESSAGES_PER_PAGE)
      
        socket.emit("chat-history-back", {
          chatId: data.chatId,
          messages: chatMessages.map(msg => ({
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt
          })),
          hasMore: chatMessages.length === MESSAGES_PER_PAGE
        })
      })

      socket.on("chat-history-forward", async (data: { chatId: string, cursor: { date: string, id: number } }) => {
        socket.join(data.chatId)
      
        const chatMessages = await db
            .select()
            .from(messages)
            .where(and(
                eq(messages.chatId, data.chatId),
                or(
                  gt(messages.createdAt, new Date(data.cursor.date)),
                  and(
                    eq(messages.createdAt, new Date(data.cursor.date)),
                    gt(messages.id, data.cursor.id)
                  )
                )
              ))
            .orderBy(asc(messages.createdAt), asc(messages.id))
            .limit(MESSAGES_PER_PAGE)
      
        socket.emit("chat-history-forward", {
          chatId: data.chatId,
          messages: chatMessages.map(msg => ({
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt
          })),
          hasMore: chatMessages.length === MESSAGES_PER_PAGE
        })
      })
    })
  }

  return new Response(null, { status: 200 })
} 