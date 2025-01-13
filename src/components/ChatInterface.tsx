"use client"

import { useState, useEffect, useRef } from "react"
import { colors } from "@/utils/colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useChannel } from "@/contexts/ChannelContext"
import { useSocket } from "@/contexts/SocketContext"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageThread } from "./MessageThread"
import { Message } from "@/components/Message"
import { Upload, Paperclip } from 'lucide-react'

type Message = {
  id: number
  content: string
  createdAt: Date
  username: string
  parentId: number | null
  channelId: number
  reactions?: {
    emoji: string
    username: string
  }[]
  attachments: {
    key: string
    filename: string
    contentType: string
    size: number
  }[]
}

type Attachment = {
  key: string
  filename: string
  contentType: string
  size: number
}

export default function ChatInterface() {
  const { currentChat, setConnectedUsers, setCurrentUser, currentUser } = useChannel()
  const { socket, isConnected } = useSocket()
  const [messages, setMessages] = useState<{ [chatId: string]: Message[] }>({})
  const [inputMessage, setInputMessage] = useState("")
  const [activeThread, setActiveThread] = useState<Message | null>(null)
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<number | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [userTable, setUserTable] = useState<{ [key: string]: string }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  /*const { ref: topLoader, inView: isTopVisible } = useInView({
    threshold: 0,
    rootMargin: '-100px 0px 0px 0px',
  })
  const { ref: bottomLoader, inView: isBottomVisible } = useInView({
    threshold: 0,
    rootMargin: '0px 0px -100px 0px',
  })

  const loadMoreMessagesBack = useCallback(() => {
    if (isLoading || !socket) return

    const oldestMessage = messages[currentChat.id]?.[0]
    
    if (oldestMessage) {
      setIsLoading(true)
      socket.emit("chat-history-back", {
        chatId: currentChat.id,
        cursor: {
          date: oldestMessage.createdAt,
          id: oldestMessage.id
        }
      })
    }
  }, [currentChat.id, messages, isLoading, socket])

  const loadMoreMessagesForward = useCallback(() => {
    if (isLoading) return

    const newestMessage = messages[currentChat.id]?.at(-1)
    
    if (newestMessage) {
      setIsLoading(true)

      socket?.emit("chat-history-forward", {
        chatId: currentChat.id,
        cursor: {
        date: newestMessage.createdAt,
        id: newestMessage.id
        }
      })
    }
  }, [currentChat.id, messages, isLoading])*/

  useEffect(() => {
    if (!socket) return

    socket.on("users-updated", (users: { id: string; username: string }[]) => {
      setConnectedUsers(users)
    })

    socket.on("usernames", (usernames: { [key: string]: string }) => {
      setUserTable(usernames)
    })

    /*socketRef.current.on("chat-history-back", (data: { 
      chatId: string, 
      messages: Message[],
      hasMore: boolean 
    }) => {
      const viewport = scrollViewportRef.current
      const firstVisibleMessage = viewport?.querySelector('.message-item')
      const messageId = messages[currentChat.id]?.[0]?.id
      const originalTop = firstVisibleMessage?.getBoundingClientRect().top ?? null
      
      for (const message of data.messages) {
        for (const message2 of messages[data.chatId] || []) {
          if (message2.id === message.id) {
            console.log("conflict")
          }
        }
      }

      setMessages(prev => {
        const oldMessages = prev[data.chatId] || [];
        const newMessages = [...data.messages.reverse(), ...oldMessages];
        return {
          ...prev,
          [data.chatId]: newMessages.slice(-250)
        };
      });

      setScrollAnchor({
        messageId,
        top: originalTop
      });

      setHasMore(prev => ({
        ...prev,
        [data.chatId]: data.hasMore
      }));
    });*/

    socket.on("chat-history", (data: { 
      channelId: number, 
      messages: Message[]
    }) => {
      console.log(data)
      setMessages(prev => ({
        ...prev,
        [data.channelId]: data.messages
      }));
    });

    /*socketRef.current.on("chat-history-forward", (data: { 
      chatId: string, 
      messages: Message[],
      hasMore: boolean 
    }) => {
      const viewport = scrollViewportRef.current
      const lastVisibleMessage = [...(viewport?.querySelectorAll('.message-item') || [])].pop()
      const lastVisibleRect = lastVisibleMessage?.getBoundingClientRect()

      for (const message of data.messages) {
        for (const message2 of messages[data.chatId] || []) {
          if (message2.id === message.id) {
            console.log("conflict")
          }
        }
      }

      setMessages(prev => {
        const oldMessages = prev[data.chatId] || [];
        const newMessages = [...oldMessages, ...data.messages];
        return {
          ...prev,
          [data.chatId]: newMessages.slice(-250)
        };
      });

      setScrollAnchor({
        messageId: messages[data.chatId]?.at(-1)?.id ?? null,
        top: lastVisibleRect?.top ?? null
      });
      
      setHasMore(prev => ({
        ...prev,
        [data.chatId]: data.hasMore
      }));
    });*/

    socket.on("new-message", (message: Message) => {
      setMessages(prevMessages => ({
        ...prevMessages,
        [message.channelId]: [...(prevMessages[message.channelId] || []), message]
      }))
    })

    socket.on("user-assigned", (data: { username: string, id: string }) => {
      setCurrentUser({ username: data.username, id: data.id })
    })

    socket.on("username-changed", (data: { username: string }) => {
      setCurrentUser(prev => prev ? { ...prev, username: data.username } : null)
    })

    socket.emit("get-user")

    return () => {
      socket.off("users-updated")
      socket.off("chat-history")
      socket.off("new-message")
      socket.off("user-assigned")
      socket.off("username-changed")
      socket.off("reaction-updated")
      socket.off("usernames")
    }
  }, [socket, setConnectedUsers, setCurrentUser])

  useEffect(() => {
    if (socket && isConnected && currentChat) {
      if (currentChat.type === "dm") {
        socket.emit("join-dm", {
          id: currentChat.clerkId
        })

        return () => {
          socket.emit("leave-dm", {
            username: currentChat.clerkId
          })
        }
      } else {
        socket.emit("join-chat", {
          channelId: currentChat.id
        })

        return () => {
          socket.emit("leave-chat", { chatId: currentChat.id })
        }
      }
    }
  }, [currentChat, isConnected, socket])

  /*useEffect(() => {
    if (isTopVisible && !isLoading) {
      loadMoreMessagesBack()
    }
  }, [isTopVisible, isLoading, hasMore, currentChat.id, loadMoreMessagesBack])

  useEffect(() => {
    if (isBottomVisible && !isLoading) {
      loadMoreMessagesForward()
    }
  }, [isBottomVisible, isLoading, hasMore, currentChat.id, loadMoreMessagesForward])

  useEffect(() => {
    if (resetIsLoading && !isBottomVisible && !isTopVisible) {
      setIsLoading(false)
      setResetIsLoading(false)
    }
  }, [resetIsLoading, isBottomVisible, isTopVisible])

  useLayoutEffect(() => {
    setResetIsLoading(true)

    if (scrollAnchor?.messageId && scrollAnchor?.top !== null && scrollViewportRef.current) {
      const viewport = scrollViewportRef.current
      if (!viewport) return

      const element = viewport.querySelector(`[data-message-id="${scrollAnchor.messageId}"]`)
      if (!element) {
        console.log("No element found")
        return
      }

      const newRect = element.getBoundingClientRect()
      console.log("Original top:", scrollAnchor.top)
      console.log("New top:", newRect.top)
      const scrollDiff = newRect.top - scrollAnchor.top
      console.log("Adjusting scroll by:", scrollDiff)
      viewport.scrollTop += scrollDiff
      
      setScrollAnchor(null)
    }
  }, [messages, scrollAnchor])*/

  

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveEmojiPicker(null)
    }

    window.addEventListener('click', handleClickOutside)

    return () => {
      window.removeEventListener('click', handleClickOutside)
    }
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    setIsUploading(true)
    try {
      const newAttachments = await Promise.all(
        Array.from(files).map(async (file) => {
          // Get presigned URL
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type
            })
          })

          if (!res.ok) {
            throw new Error(`Failed to get upload URL: ${res.statusText}`)
          }

          const { url, fields, key } = await res.json()

          // Create form data for upload
          const formData = new FormData()
          Object.entries(fields).forEach(([key, value]) => {
            formData.append(key, value as string)
          })
          formData.append('file', file)

          // Upload to S3
          await fetch(url, {
            method: 'POST',
            body: formData
          })

          // If we get here, upload was successful
          return {
            key: key,
            filename: file.name,
            contentType: file.type,
            size: file.size
          }
        })
      )

      setAttachments(prev => [...prev, ...newAttachments])
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if ((inputMessage.trim() || attachments.length) && socket && isConnected && currentChat) {
      if (currentChat.type === "dm") {
        socket.emit("send-dm", {
          username: currentChat.clerkId,
          content: inputMessage,
          attachments
        })
      } else {
        socket.emit("send-message", {
          channelId: currentChat.id,
          content: inputMessage,
          attachments
        })
      }
      setInputMessage("")
      setAttachments([])
    }
  }

  if (!currentChat) return null

  console.log(messages)

  return (
    <div className="flex flex-col h-screen">
      <div className={`${colors.primary} p-4 text-white font-semibold`}>
        {currentChat.type === "channel" ? "#" : "@"} {currentChat.name}
      </div>
      <ScrollArea 
        className={`${colors.secondary} flex-grow p-4`}
      >    
        {messages[currentChat.type === "dm" ? `dm-${[currentChat.clerkId, currentUser?.id].sort().join("-")}` : currentChat.id]?.filter(message => message.parentId === null).map((message) => (
          <div key={message.id}>
            <Message
              username={userTable[message.username]}
              content={message.content}
              onClick={() => setActiveThread(activeThread?.id === message.id ? null : message)}
              data-message-id={message.id}
              reactions={message.reactions}
              messageId={message.id}
              activeEmojiPicker={activeEmojiPicker}
              setActiveEmojiPicker={setActiveEmojiPicker}
              attachments={message.attachments}
            />
            {activeThread && activeThread.id === message.id && (
              <div className="ml-8 mb-4 border-l-2 border-gray-300">
                <MessageThread
                  userTable={userTable}
                  parentMessage={activeThread}
                  onClose={() => setActiveThread(null)}
                  channel={currentChat.type === "dm" ? {
                    id: currentChat.clerkId,
                    type: "dm"
                  } : {
                    id: currentChat.id,
                    type: "channel"
                  }}
                  activeEmojiPicker={activeEmojiPicker}
                  setActiveEmojiPicker={setActiveEmojiPicker}
                />
              </div>
            )}
          </div>
        ))}
      </ScrollArea>
      
      <form onSubmit={handleSendMessage} className="flex flex-col p-4 bg-gray-300">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((file, index) => (
              <div key={index} className="flex items-center gap-1 bg-white rounded px-2 py-1">
                <span className="text-sm truncate max-w-[200px]">{file.filename}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className={`flex-grow ${colors.input}`}
            placeholder={`Message ${currentChat.type === "channel" ? "#" : "@"}${currentChat.name}`}
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? <Upload className="animate-bounce" /> : <Paperclip />}
          </Button>
          <Button type="submit" className={`${colors.primary}`}>
            Send
          </Button>
        </div>
      </form>
    </div>
  )
}
