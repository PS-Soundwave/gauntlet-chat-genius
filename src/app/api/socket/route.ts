import { Server as SocketIOServer } from "socket.io"
import { NextRequest } from "next/server"
import { db } from '@/db'
import { messageContents, messages, directMessages, messageIds } from '@/db/schema'
import { eq, and, or, asc } from 'drizzle-orm'
import { reactions } from '@/db/schema'
import { clerkClient, getAuth, verifyToken } from "@clerk/nextjs/server"

interface CustomGlobal {
  io?: SocketIOServer
}

const socketServer: CustomGlobal = {}

interface SocketUser {
  username: string
  clerkId: string
  email: string
}

const users = new Map<string, SocketUser>()
const activeUsers = new Set<string>()

export async function GET(req: NextRequest) {
  const { userId, sessionId } = getAuth(req)
  
  if (!userId || !sessionId) {
    return new Response("Unauthorized", { status: 401 })
  }

  if (socketServer.io) {
    console.log("Socket is already running")
    return  new Response(null, { status: 200 })
  } else {
    console.log("Socket is initializing")
    socketServer.io = new SocketIOServer(3001, {
      cors: {
        origin: "http://localhost:3001",
      },
      transports: ['websocket'],
      path: "/ws/"
    })

    socketServer.io.on("connection", async (socket) => {
      console.log("Client connected")

      socket.on("auth", async (data: { token: string }) => {
        const payload = await verifyToken(data.token, {
          secretKey: process.env.CLERK_SECRET_KEY
        })

        const client = await clerkClient()
        const user = await client.users.getUser(payload.sub);


        if (activeUsers.has(user.id)) {
          socket.emit("auth-fail")
          return
        }

        users.set(socket.id, {
          username: user.username || user.emailAddresses[0].emailAddress,
          clerkId: user.id,
          email: user.emailAddresses[0].emailAddress
        })
        activeUsers.add(user.id)

        socket.emit("auth-success")
        socket.emit("user-assigned", { username: user.username, id: user.id })

        const connectedUsers = Array.from(users.values()).map(user => ({
          id: user.clerkId,
          username: user.username
        }))
        socketServer.io?.emit("users-updated", connectedUsers)
      })
      
      socket.on("join-chat", async (data: { chatId: string }) => {
        socket.join(`channel-${data.chatId}`)

        const chatMessages = await db.query.messages.findMany({
          where: eq(messages.chatId, `${data.chatId}`),
          with: {
            messageContent: {
              columns: {
                content: true,
                username: true
              },
              with: {
                reactions: {
                  columns: {
                    emoji: true,
                    username: true
                  }
                }
              }
            }
          },
          orderBy: asc(messages.createdAt)
        }).then(messages => messages.map(msg => ({
          id: msg.id,
          content: msg.messageContent.content,
          username: msg.messageContent.username,
          createdAt: msg.createdAt,
          parentId: msg.parentId,
          reactions: msg.messageContent.reactions
        })))
      
        socket.emit("chat-history", {
          chatId: data.chatId,
          messages: chatMessages
        })
      })

      socket.on("join-dm", async (data: { id: string }) => {
        const currentUser = users.get(socket.id)
        if (!currentUser || data.id === currentUser.clerkId) return
        
        const [participant1, participant2] = [currentUser.clerkId, data.id].sort()
        
        const chatId = `dm-${participant1}-${participant2}`
        
        console.log("Joining DM chatId:", chatId)
        socket.join(chatId)
        const chatMessages = await db.query.directMessages.findMany({
          where: and(
            eq(directMessages.participant1, participant1),
            eq(directMessages.participant2, participant2)
          ),
          with: {
            messageContent: {
              columns: {
                content: true,
                username: true
              },
              with: {
                reactions: {
                  columns: {
                    emoji: true,
                    username: true
                  }
                }
              }
            }
          },
          orderBy: asc(directMessages.createdAt)
        }).then(messages => messages.map(msg => ({
          id: msg.id,
          content: msg.messageContent.content,
          username: msg.messageContent.username,
          createdAt: msg.createdAt,
          parentId: msg.parentId,
          reactions: msg.messageContent.reactions
        })))

        socket.emit("chat-history", {
          chatId,
          messages: chatMessages
        })
      })

      socket.on("leave-chat", (data: { chatId: string }) => {
        socket.leave(`channel-${data.chatId}`)
      })

      socket.on("leave-dm", (data: { username: string }) => {
        socket.leave(`dm-${[data.username, users.get(socket.id)?.clerkId].sort().join('-')}`)
      })

      socket.on("send-dm", async (message: { 
        username: string, 
        content: string,
        parentId?: number
      }) => {
        console.log("Sending DM:", message)
        const user = users.get(socket.id)
        if (!user) return

        const [participant1, participant2] = [user.clerkId, message.username].sort()

        // If there's a parentId, verify it belongs to this DM conversation
        if (message.parentId) {
          const parentMessage = await db.query.directMessages.findFirst({
            where: eq(directMessages.id, message.parentId),
            columns: {
              participant1: true,
              participant2: true
            }
          })

          if (!parentMessage || 
              parentMessage.participant1 !== participant1 || 
              parentMessage.participant2 !== participant2) {
            return
          }
        }

        // Create new message ID
        const [newMessageId] = await db.insert(messageIds)
          .values({ type: 'direct_message' })
          .returning()

        // Create message content
        const [newMessageContent] = await db.insert(messageContents)
          .values({
            content: message.content,
            username: user.username
          })
          .returning()

        // Create direct message
        const [newMessage] = await db.insert(directMessages)
          .values({
            id: newMessageId.id,
            type: 'direct_message',
            contentId: newMessageContent.id,
            participant1,
            participant2,
            parentId: message.parentId || null
          })
          .returning()

        const chatId = `dm-${[user.clerkId, message.username].sort().join('-')}`

        console.log("New DM chatId:", chatId)

        if (message.parentId) {
          socketServer.io?.to(`${chatId}-thread-${message.parentId}`).emit("new-thread-message", {
            ...newMessageContent,
            ...newMessage,
            chatId
          })
        } else {
          socketServer.io?.to(chatId).emit("new-message", {
            ...newMessageContent,
            ...newMessage,
            chatId
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

        // If there's a parentId, verify it belongs to this channel
        if (message.parentId) {
          const parentMessage = await db.query.messages.findFirst({
            where: eq(messages.id, message.parentId),
            columns: {
              chatId: true
            }
          })

          if (!parentMessage || parentMessage.chatId !== `${message.chatId}`) {
            return // Parent message doesn't exist or belongs to different channel
          }
        }

        // Create new message ID
        const [newMessageId] = await db.insert(messageIds)
          .values({ type: 'message' })
          .returning()

        // Create message content
        const [newMessageContent] = await db.insert(messageContents)
          .values({
            content: message.content,
            username: user.username
          })
          .returning()

        // Create channel message
        const [newMessage] = await db.insert(messages)
          .values({
            id: newMessageId.id,
            type: 'message',
            contentId: newMessageContent.id,
            chatId: `${message.chatId}`,
            parentId: message.parentId || null
          })
          .returning()

        if (message.parentId) {
          socketServer.io?.to(`thread-${message.parentId}`).emit("new-thread-message", {
            ...newMessageContent,
            ...newMessage,
            chatId: message.chatId
          })
        } else {
          socketServer.io?.emit("new-message", {
            ...newMessageContent,
            ...newMessage,
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

        const threadMessages = await db.query.messages.findMany({
          where: and(
            eq(messages.chatId, `${data.chatId}`),
            eq(messages.parentId, data.messageId)
          ),
          with: {
            messageContent: {
              columns: {
                content: true,
                username: true
              },
              with: {
                reactions: {
                  columns: {
                    emoji: true,
                    username: true
                  }
                }
              }
            }
          },
          orderBy: asc(messages.createdAt)
        }).then(messages => messages.map(msg => ({
          id: msg.id,
          content: msg.messageContent.content,
          username: msg.messageContent.username,
          createdAt: msg.createdAt,
          reactions: msg.messageContent.reactions
        })))

        socket.emit("thread-history", {
          messageId: data.messageId,
          messages: threadMessages
        })
      })

      socket.on("join-dm-thread", async (data: { messageId: number, username: string }) => {
        const user = users.get(socket.id)
        if (!user) return

        const chatId = `dm-${[user.clerkId, data.username].sort().join('-')}`
        const [participant1, participant2] = [user.clerkId, data.username].sort()
        const threadId = `${chatId}-thread-${data.messageId}`
        socket.join(threadId)

        const threadMessages = await db.query.directMessages.findMany({
          where: and(
            eq(directMessages.participant1, participant1),
            eq(directMessages.participant2, participant2),
            eq(directMessages.parentId, data.messageId)
          ),
          with: {
            messageContent: {
              columns: {
                content: true,
                username: true
              },
              with: {
                reactions: {
                  columns: {
                    emoji: true,
                    username: true
                  }
                }
              }
            }
          },
          orderBy: asc(directMessages.createdAt)
        }).then(messages => messages.map(msg => ({
          id: msg.id,
          content: msg.messageContent.content,
          username: msg.messageContent.username,
          createdAt: msg.createdAt,
          reactions: msg.messageContent.reactions
        })))

        socket.emit("thread-history", {
          messageId: data.messageId,
          messages: threadMessages
        })
      })

      socket.on("leave-thread", (data: { messageId: number }) => {
        socket.leave(`thread-${data.messageId}`)
      })

      socket.on("leave-dm-thread", (data: { messageId: number, username: string }) => {
        socket.leave(`dm-${[data.username, users.get(socket.id)?.clerkId].sort().join('-')}-thread-${data.messageId}`)
      })  

      socket.on("disconnect", () => {
        console.log("Client disconnected")
        const user = users.get(socket.id);
        if (user) {
          activeUsers.delete(user.clerkId)
        }
        
        users.delete(socket.id)

        const connectedUsers = Array.from(users.values()).map(user => ({
          id: user.clerkId,
          username: user.username
        }))
        socketServer.io?.emit("users-updated", connectedUsers)
      })

      socket.on("react-to-message", async (data: { 
        messageId: number, 
        emoji: string
      }) => {
        const user = users.get(socket.id)
        if (!user) return

        const messageType = await db.query.messageIds.findFirst({
          where: eq(messageIds.id, data.messageId),
          columns: { type: true }
        })

        if (!messageType) return

        if (messageType.type === 'direct_message') {
          const messageRecord = await db.query.directMessages.findFirst({
            where: and(
              eq(directMessages.id, data.messageId),
              or(
                eq(directMessages.participant1, user.clerkId),
                eq(directMessages.participant2, user.clerkId)
              )
            ),
            columns: { contentId: true, parentId: true, participant1: true, participant2: true }
          })

          if (!messageRecord) return

          const existingReaction = await db.delete(reactions)
          .where(and(
            eq(reactions.messageId, messageRecord.contentId),
            eq(reactions.username, user.clerkId),
            eq(reactions.emoji, data.emoji)
          ))
          .returning()

          if (existingReaction.length === 0) {
            await db.insert(reactions).values({
              messageId: messageRecord.contentId,
              username: user.clerkId,
              emoji: data.emoji
            })
          }

          const allReactions = await db
          .select({
            emoji: reactions.emoji,
            username: reactions.username
          })
          .from(reactions)
          .where(eq(reactions.messageId, messageRecord.contentId))
          
          const chatId = messageRecord.participant1 === user.clerkId ? messageRecord.participant2 : messageRecord.participant1

          const room = messageRecord.parentId
            ? `dm-${messageRecord.participant1}-${messageRecord.participant2}-thread-${messageRecord.parentId}`
            : `dm-${messageRecord.participant1}-${messageRecord.participant2}`
          
          socketServer.io?.to(room).emit("reaction-updated", {
            messageId: data.messageId,
            reactions: allReactions,
            chatId: chatId
          })
        } else {
          const messageRecord = await db.query.messages.findFirst({
            where: eq(messages.id, data.messageId),
            columns: { contentId: true, parentId: true, chatId: true }
          })

          if (!messageRecord) return

          const existingReaction = await db.delete(reactions)
          .where(and(
            eq(reactions.messageId, messageRecord.contentId),
            eq(reactions.username, user.clerkId),
            eq(reactions.emoji, data.emoji)
          ))
          .returning()

          if (existingReaction.length === 0) {
            await db.insert(reactions).values({
              messageId: messageRecord.contentId,
              username: user.clerkId,
              emoji: data.emoji
            })
          }

          const chatId = messageRecord.chatId

          const allReactions = await db
          .select({
            emoji: reactions.emoji,
            username: reactions.username
          })
          .from(reactions)
          .where(eq(reactions.messageId, messageRecord.contentId))

          const room = messageRecord.parentId
            ? `thread-${messageRecord.parentId}`
            : `channel-${messageRecord.chatId}`

          socketServer.io?.to(room).emit("reaction-updated", {
            messageId: data.messageId,
            reactions: allReactions,
            chatId: chatId
          })
        }
      })
    })
  }

  return new Response(null, { status: 200 })
} 