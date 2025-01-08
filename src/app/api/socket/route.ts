import { Server as SocketIOServer } from "socket.io"
import { NextRequest } from "next/server"
import { db } from '@/db'
import { messages } from '@/db/schema'
import { eq, lt, desc, and, or, gt, asc } from 'drizzle-orm'
import { generateUsername } from '@/utils/username'

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

interface SocketUser {
  username: string
}

const users = new Map<string, SocketUser>()

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
      
      const username = generateUsername()
      users.set(socket.id, { username })
      socket.emit("user-assigned", { username })

      const connectedUsers = Array.from(users.values())
      global.socketServer.io?.emit("users-updated", connectedUsers)
      
      socket.on("join-chat", async (data: { chatId: string }) => {
        socket.join(`channel-${data.chatId}`)
      
        const chatMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.chatId, `channel-${data.chatId}`))
            .orderBy(asc(messages.createdAt))
      
        socket.emit("chat-history", {
          chatId: data.chatId,
          messages: chatMessages
        })
      })

      socket.on("join-dm", async (data: { username: string }) => {
        const currentUser = users.get(socket.id)

        if (data.username === currentUser?.username) {
          return
        }
        
        const chatId = `dm-${[currentUser?.username, data.username].sort().join('-')}`

        socket.join(chatId)
        const chatMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.chatId, chatId))
            .orderBy(asc(messages.createdAt))
      
        socket.emit("chat-history", {
          chatId,
          messages: chatMessages
        })
      })

      socket.on("leave-chat", (data: { chatId: string }) => {
        socket.leave(`channel-${data.chatId}`)
      })

      socket.on("leave-dm", (data: { username: string }) => {
        socket.leave(`dm-${[data.username, users.get(socket.id)?.username].sort().join('-')}`)
      })

      socket.on("send-dm", async (message: { 
        username: string, 
        content: string,
        parentId?: number
      }) => {
        const user = users.get(socket.id)
        if (!user) return

        const chatId = `dm-${[user.username, message.username].sort().join('-')}`

        const newMessage = await db.insert(messages).values({
          chatId,
          content: message.content,
          username: user.username,
          parentId: message.parentId || null
        }).returning()

        if (message.parentId) {
          global.socketServer.io?.to(`${chatId}-thread-${message.parentId}`).emit("new-thread-message", {
            ...newMessage[0]
          })
        } else {
          global.socketServer.io?.to(chatId).emit("new-message", {
            ...newMessage[0]
          })
        }
      })

      socket.on("send-message", async (message: { 
        chatId: string, 
        content: string,
        parentId?: number
      }) => {
        const user = users.get(socket.id)
        if (!user) return

        const newMessage = await db.insert(messages).values({
          chatId: `channel-${message.chatId}`,
          content: message.content,
          username: user.username,
          parentId: message.parentId || null
        }).returning()

        if (message.parentId) {
          global.socketServer.io?.to(`thread-${message.parentId}`).emit("new-thread-message", {
            ...newMessage[0],
            chatId: message.chatId
          })
        } else {
          global.socketServer.io?.emit("new-message", {
            ...newMessage[0],
            chatId: message.chatId
          })
        }
      })

      /*socket.on("chat-history-back", async (data: { chatId: string, cursor: { date: string, id: number } }) => {
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
      })*/

      /*socket.on("chat-history-forward", async (data: { chatId: string, cursor: { date: string, id: number } }) => {
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
      })*/

      socket.on("join-thread", async (data: { messageId: number, chatId: string }) => {
        const threadId = `thread-${data.messageId}`
        socket.join(threadId)

        const threadMessages = await db
          .select()
          .from(messages)
          .where(and(
            eq(messages.chatId, `channel-${data.chatId}`),
            eq(messages.parentId, data.messageId)))
          .orderBy(asc(messages.createdAt))

        socket.emit("thread-history", {
          messageId: data.messageId,
          messages: threadMessages
        })
      })

      socket.on("join-dm-thread", async (data: { messageId: number, username: string }) => {
        const user = users.get(socket.id)
        if (!user) return

        const chatId = `dm-${[user.username, data.username].sort().join('-')}`
        const threadId = `${chatId}-thread-${data.messageId}`
        socket.join(threadId)

        const threadMessages = await db
          .select()
          .from(messages)
          .where(and(
            eq(messages.chatId, chatId),
            eq(messages.parentId, data.messageId)))
          .orderBy(asc(messages.createdAt))

        socket.emit("thread-history", {
          messageId: data.messageId,
          messages: threadMessages
        })
      })

      socket.on("leave-thread", (data: { messageId: number }) => {
        socket.leave(`thread-${data.messageId}`)
      })

      socket.on("leave-dm-thread", (data: { messageId: number, username: string }) => {
        socket.leave(`dm-${[data.username, users.get(socket.id)?.username].sort().join('-')}-thread-${data.messageId}`)
      })  

      socket.on("disconnect", () => {
        users.delete(socket.id)

        const connectedUsers = Array.from(users.values())
        global.socketServer.io?.emit("users-updated", connectedUsers)
      })
    })
  }

  return new Response(null, { status: 200 })
} 