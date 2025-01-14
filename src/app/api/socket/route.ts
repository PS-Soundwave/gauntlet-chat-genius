import { Server as SocketIOServer } from "socket.io"
import { NextRequest } from "next/server"
import { db } from '@/db'
import { messageContents, messages, directMessages, messageIds, channels, attachments } from '@/db/schema'
import { eq, and, or, asc } from 'drizzle-orm'
import { reactions, users as usersTable } from '@/db/schema'
import { clerkClient, getAuth, verifyToken } from "@clerk/nextjs/server"
import { generateUsername } from "@/utils/username"
import { generateEmbedding } from "@/lib/embeddings"
import { upsertMessage, CHANNEL_TO_VECTORIZE, QUERY_CHANNEL } from "@/lib/pinecone"
import { answerWithContext } from "@/lib/rag"

interface CustomGlobal {
  io?: SocketIOServer
}

const socketServer: CustomGlobal = {}

interface SocketUser {
  username: string
  clerkId: string
}

const users = new Map<string, SocketUser>()
const activeUsers = new Set<string>()

// Add this function to handle message vectorization
async function vectorizeAndStoreMessage(messageData: {
  id: number,
  content: string,
  userId: string,
  channelId: number,
  createdAt: Date,
  parentId: number | null
}) {
  if (messageData.channelId !== CHANNEL_TO_VECTORIZE) {
    return
  }

  try {
    const embedding = await generateEmbedding(messageData.content)
    await upsertMessage({
      ...messageData,
      embedding
    })
  } catch (error) {
    console.error('Error vectorizing message:', error)
  }
}

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

        let [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, user.id))

        if (!dbUser) {
          try {
            [dbUser] = await db.insert(usersTable).values({
              clerkId: user.id,
              username: user.username || generateUsername()
            }).returning()
          } catch {
            socket.emit("auth-fail")
            return
          }
        }
        
        users.set(socket.id, {
          username: dbUser.username,
          clerkId: user.id,
        })
        activeUsers.add(user.id)

        socket.emit("auth-success")

        const connectedUsers = Array.from(users.values()).map(user => ({
          id: user.clerkId,
          username: user.username
        }))
        socketServer.io?.emit("users-updated", connectedUsers)
        socketServer.io?.emit("usernames", await db.select().from(usersTable).then(users => users.reduce((acc, user) => ({ ...acc, [user.clerkId]: user.username }), {})))
      })
      
      socket.on("get-user", () => {
        const user = users.get(socket.id);

        if (!user) return

        socket.emit("user-assigned", { username: user.username, id: user.clerkId })
      });

      socket.on("change-username", async (data: { newUsername: string }) => {
        const user = users.get(socket.id)
        if (!user) return

        try {
          // Update the username in the database
          await db.update(usersTable)
            .set({ username: data.newUsername })
            .where(eq(usersTable.clerkId, user.clerkId))
            .returning()

          // Update the username in memory
          users.set(socket.id, {
            ...user,
            username: data.newUsername
          })
          
          // Notify the user of successful update
          socket.emit("username-changed", { username: data.newUsername })

          // Notify all connected users of the change
          const connectedUsers = Array.from(users.values()).map(user => ({
            id: user.clerkId,
            username: user.username
          }))
          socketServer.io?.emit("users-updated", connectedUsers)
          socketServer.io?.emit("usernames", await db.select().from(usersTable).then(users => users.reduce((acc, user) => ({ ...acc, [user.clerkId]: user.username }), {})))
        } catch {}
      });

      socket.on("join-chat", async (data: { channelId: number }) => {
        const user = users.get(socket.id)
        if (!user) return

        socket.join(`channel-${data.channelId}`)

        const chatMessages = await db.query.messages.findMany({
          where: eq(messages.channelId, data.channelId),
          with: {
            messageContent: {
              columns: {
                content: true
              },
              with: {
                reactions: {
                  columns: {
                    emoji: true,
                    username: true
                  }
                },
                attachments: {
                  columns: {
                    url: true,
                    filename: true,
                    contentType: true,
                    size: true
                  }
                }
              }
            },
            user: {
              columns: {
                username: true
              }
            }
          },
          orderBy: asc(messages.createdAt)
        }).then(messages => messages.map(msg => ({
          id: msg.id,
          content: msg.messageContent.content,
          username: msg.userId,
          createdAt: msg.createdAt,
          parentId: msg.parentId,
          reactions: msg.messageContent.reactions,
          attachments: msg.messageContent.attachments.map(attachment => ({
            key: attachment.url,
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.size
          }))
        })))
      
        socket.emit("chat-history", {
          channelId: data.channelId,
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
                content: true
              },
              with: {
                reactions: {
                  columns: {
                    emoji: true,
                    username: true
                  }
                },
                attachments: {
                  columns: {
                    url: true,
                    filename: true,
                    contentType: true,
                    size: true
                  }
                }
              }
            },
            user: {
              columns: {
                username: true
              }
            }
          },
          orderBy: asc(directMessages.createdAt)
        }).then(messages => messages.map(msg => ({
          id: msg.id,
          content: msg.messageContent.content,
          username: msg.userId,
          createdAt: msg.createdAt,
          parentId: msg.parentId,
          reactions: msg.messageContent.reactions,
          attachments: msg.messageContent.attachments.map(attachment => ({
            key: attachment.url,
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.size
          }))
        })))

        socket.emit("chat-history", {
          channelId: chatId,
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
        parentId?: number,
        attachments?: Array<{
          key: string,
          filename: string,
          contentType: string,
          size: number
        }>
      }) => {
        const user = users.get(socket.id)
        if (!user) return

        const [participant1, participant2] = [user.clerkId, message.username].sort()
        console.log(message)
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
            content: message.content
          })
          .returning()

        // Create attachments if any
        if (message.attachments?.length) {
          await db.insert(attachments)
            .values(message.attachments.map(attachment => ({
              messageContentId: newMessageContent.id,
              url: attachment.key,
              filename: attachment.filename,
              contentType: attachment.contentType,
              size: attachment.size
            })))
        }

        // Create direct message
        const [newMessage] = await db.insert(directMessages)
          .values({
            id: newMessageId.id,
            type: 'direct_message',
            contentId: newMessageContent.id,
            userId: user.clerkId,
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
            channelId: chatId,
            attachments: message.attachments,
            username: user.clerkId
          })
        } else {
          socketServer.io?.to(chatId).emit("new-message", {
            ...newMessageContent,
            ...newMessage,
            channelId: chatId,
            attachments: message.attachments,
            username: user.clerkId
          })
        }
      })

      socket.on("send-message", async (message: { 
        channelId: number, 
        content: string,
        parentId?: number,
        attachments?: Array<{
          key: string,
          filename: string,
          contentType: string,
          size: number
        }>
      }) => {
        const user = users.get(socket.id)
        if (!user) return

        // Handle query channel separately
        if (message.channelId === QUERY_CHANNEL) {
          try {
            const { answer, relevantMessages } = await answerWithContext(message.content)
            
            // Format the response as a regular message
            const responseMessage = {
              id: Date.now(), // Use timestamp as temporary ID
              content: answer,
              channelId: message.channelId,
              username: user.clerkId, // Make it appear from the same user
              createdAt: new Date(),
              parentId: null,
              attachments: [],
              reactions: []
            }

            // Send the response only to the user who asked
            socket.emit("new-message", responseMessage)

            // Also send the relevant messages as system messages
            const contextMessage = {
              id: Date.now() + 1,
              content: "Here are the relevant messages I found:\n\n" + 
                      relevantMessages.map(msg => 
                        `[${new Date(msg.createdAt).toLocaleString()}] ${msg.userId}:\n${msg.content}\n`
                      ).join("\n"),
              channelId: message.channelId,
              username: user.clerkId,
              createdAt: new Date(),
              parentId: null,
              attachments: [],
              reactions: []
            }

            socket.emit("new-message", contextMessage)
            return
          } catch (error) {
            console.error('Error processing query:', error)
            const errorMessage = {
              id: Date.now(),
              content: "Sorry, I encountered an error processing your query.",
              channelId: message.channelId,
              username: user.clerkId,
              createdAt: new Date(),
              parentId: null,
              attachments: [],
              reactions: []
            }
            socket.emit("new-message", errorMessage)
            return
          }
        }

        // If there's a parentId, verify it belongs to this channel
        if (message.parentId) {
          const parentMessage = await db.query.messages.findFirst({
            where: eq(messages.id, message.parentId),
            columns: {
              channelId: true
            }
          })

          if (!parentMessage || parentMessage.channelId !== message.channelId) {
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
            content: message.content
          })
          .returning()

        // Create attachments if any
        if (message.attachments?.length) {
          await db.insert(attachments)
            .values(message.attachments.map(attachment => ({
              messageContentId: newMessageContent.id,
              url: attachment.key,
              filename: attachment.filename,
              contentType: attachment.contentType,
              size: attachment.size
            })))
        }

        // Create channel message
        const [newMessage] = await db.insert(messages)
          .values({
            id: newMessageId.id,
            type: 'message',
            userId: user.clerkId,
            contentId: newMessageContent.id,
            channelId: message.channelId,
            parentId: message.parentId || null
          })
          .returning()

        // Vectorize if it's in the vectorize channel
        if (message.channelId === CHANNEL_TO_VECTORIZE) {
          await vectorizeAndStoreMessage({
            id: newMessage.id,
            content: message.content,
            userId: user.clerkId,
            channelId: message.channelId,
            createdAt: newMessage.createdAt ?? new Date(),
            parentId: message.parentId || null
          })
        }

        if (message.parentId) {
          socketServer.io?.to(`thread-${message.parentId}`).emit("new-thread-message", {
            ...newMessageContent,
            ...newMessage,
            attachments: message.attachments,
            username: user.clerkId
          })
        } else {
          socketServer.io?.to(`channel-${message.channelId}`).emit("new-message", {
            ...newMessageContent,
            ...newMessage,
            channelId: message.channelId,
            attachments: message.attachments,
            username: user.clerkId
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

      socket.on("join-thread", async (data: { messageId: number, channelId: number }) => {
        const user = users.get(socket.id)
        if (!user) return

        const threadId = `thread-${data.messageId}`
        socket.join(threadId)

        const threadMessages = await db.query.messages.findMany({
          where: and(
            eq(messages.channelId, data.channelId),
            eq(messages.parentId, data.messageId)
          ),
          with: {
            messageContent: {
              columns: {
                content: true
              },
              with: {
                reactions: {
                  columns: {
                    emoji: true,
                    username: true
                  }
                },
                attachments: {
                  columns: {
                    url: true,
                    filename: true,
                    contentType: true,
                    size: true
                  }
                }
              }
            },
            user: {
              columns: {
                username: true
              }
            }
          },
          orderBy: asc(messages.createdAt)
        }).then(messages => messages.map(msg => ({
          id: msg.id,
          content: msg.messageContent.content,
          username: msg.userId,
          createdAt: msg.createdAt,
          reactions: msg.messageContent.reactions,
          attachments: msg.messageContent.attachments.map(attachment => ({
            key: attachment.url,
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.size
          }))
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
                content: true
              },
              with: {
                reactions: {
                  columns: {
                    emoji: true,
                    username: true
                  }
                },
                attachments: {
                  columns: {
                    url: true,
                    filename: true,
                    contentType: true,
                    size: true
                  }
                }
              },
            },
            user: {
              columns: {
                username: true
              }
            }
          },
          orderBy: asc(directMessages.createdAt)
        }).then(messages => messages.map(msg => ({
          id: msg.id,
          content: msg.messageContent.content,
          username: msg.userId,
          createdAt: msg.createdAt,
          reactions: msg.messageContent.reactions,
          attachments: msg.messageContent.attachments.map(attachment => ({
            key: attachment.url,
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.size
          }))
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
          
          const room = messageRecord.parentId
            ? `dm-${messageRecord.participant1}-${messageRecord.participant2}-thread-${messageRecord.parentId}`
            : `dm-${messageRecord.participant1}-${messageRecord.participant2}`
          
          socketServer.io?.to(room).emit("reaction-updated", {
            messageId: data.messageId,
            reactions: allReactions,
          })
        } else {
          const messageRecord = await db.query.messages.findFirst({
            where: eq(messages.id, data.messageId),
            columns: { contentId: true, parentId: true, channelId: true }
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

          const room = messageRecord.parentId
            ? `thread-${messageRecord.parentId}`
            : `channel-${messageRecord.channelId}`

          socketServer.io?.to(room).emit("reaction-updated", {
            messageId: data.messageId,
            reactions: allReactions
          })
        }
      })

      socket.on("get-channels", async () => {
        const user = users.get(socket.id)
        if (!user) return

        const allChannels = await db.query.channels.findMany({
          columns: {
            id: true,
            name: true
          },
          orderBy: (channels, { asc }) => [asc(channels.name)]
        })

        socket.emit("channels", allChannels)
      })

      socket.on("add-channel", async (data: { name: string }) => {
        const user = users.get(socket.id)
        if (!user) return

        try {
          await db.insert(channels)
            .values({
              name: data.name
            })

          const allChannels = await db.query.channels.findMany({
            columns: {
              id: true,
              name: true
            },
            orderBy: (channels, { asc }) => [asc(channels.name)]
          })

          socketServer.io?.emit("channels", allChannels)
        } catch {}
      })

      socket.on("remove-channel", async (data: { channelId: number }) => {
        const user = users.get(socket.id)
        if (!user) return

        try {
          await db.delete(channels)
            .where(eq(channels.id, data.channelId));
        } catch {}

        const allChannels = await db.query.channels.findMany({
          columns: {
            id: true,
            name: true
          },
          orderBy: (channels, { asc }) => [asc(channels.name)]
        })

        // Notify all clients about the removed channel
        socketServer.io?.emit("channels", allChannels)
      })
    })
  }

  return new Response(null, { status: 200 })
} 