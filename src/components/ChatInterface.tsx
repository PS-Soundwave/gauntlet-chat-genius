"use client"

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react"
import { colors } from "@/utils/colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useChannel } from "@/contexts/ChannelContext"
import { useSocket } from "@/contexts/SocketContext"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useInView } from 'react-intersection-observer'
import { MessageThread } from "./MessageThread"
import { Message } from "@/components/Message"

type Message = {
  id: number
  content: string
  createdAt: Date
  username: string
  parentId: number | null
  chatId: string
  reactions?: {
    emoji: string
    username: string
  }[]
}

export default function ChatInterface() {
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const { currentChat, setConnectedUsers, setCurrentUser } = useChannel()
  const { socket, isConnected } = useSocket()
  const [messages, setMessages] = useState<{ [chatId: string]: Message[] }>({})
  const [hasMore, setHasMore] = useState<{ [chatId: string]: boolean }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [inputMessage, setInputMessage] = useState("")
  const [resetIsLoading, setResetIsLoading] = useState(false)
  const [scrollAnchor, setScrollAnchor] = useState<{
    messageId: number | null;
    top: number | null;
  } | null>(null);
  const [username, setUsername] = useState<string>("")
  const [activeThread, setActiveThread] = useState<Message | null>(null)
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<number | null>(null)

  const { ref: topLoader, inView: isTopVisible } = useInView({
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
  }, [currentChat.id, messages, hasMore, isLoading])

  useEffect(() => {
    if (!socket) return

    socket.on("users-updated", (users: { id: string; username: string }[]) => {
      setConnectedUsers(users)
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
      chatId: string, 
      messages: Message[]
    }) => {
      setMessages(prev => ({
        ...prev,
        [data.chatId]: data.messages
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
        [message.chatId]: [...(prevMessages[message.chatId] || []), message]
      }))
    })

    socket.on("user-assigned", (data: { username: string, id: string }) => {
      setCurrentUser({ username: data.username, id: data.id })
    })

    return () => {
      socket.off("users-updated")
      socket.off("chat-history")
      socket.off("new-message")
      socket.off("user-assigned")
      socket.off("reaction-updated")
    }
  }, [socket, setConnectedUsers, setCurrentUser])

  useEffect(() => {
    if (socket && isConnected) {
      if (currentChat.type === "dm") {
        socket.emit("join-dm", {
          id: currentChat.clerkId
        })

        return () => {
          socket.emit("leave-dm", {
            username: currentChat.id
          })
        }
      } else {
        socket.emit("join-chat", {
          chatId: currentChat.id
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputMessage.trim() && socket && isConnected) {
      if (currentChat.type === "dm") {
        socket.emit("send-dm", {
          username: currentChat.clerkId,
          content: inputMessage
        })
      } else {
        socket.emit("send-message", { chatId: currentChat.id, content: inputMessage })
      }
      setInputMessage("")
    }
  }

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveEmojiPicker(null)
    }

    window.addEventListener('click', handleClickOutside)

    return () => {
      window.removeEventListener('click', handleClickOutside)
    }
  }, [])

  return (
    <div className="flex flex-col h-screen">
      <div className={`${colors.primary} p-4 text-white font-semibold`}>
        {currentChat.type === "channel" ? "#" : "@"} {currentChat.name}
      </div>
      <ScrollArea 
        className={`${colors.secondary} flex-grow p-4`}
        viewportRef={scrollViewportRef}
      >
        <div ref={topLoader} className="h-16" />
        
        {messages[currentChat.id]?.filter(message => message.parentId === null).map((message) => (
          <div key={message.id}>
            <Message
              username={message.username}
              content={message.content}
              onClick={() => setActiveThread(activeThread?.id === message.id ? null : message)}
              data-message-id={message.id}
              reactions={message.reactions}
              messageId={message.id}
              activeEmojiPicker={activeEmojiPicker}
              setActiveEmojiPicker={setActiveEmojiPicker}
            />
            {activeThread && activeThread.id === message.id && (
              <div className="ml-8 mb-4 border-l-2 border-gray-300">
                <MessageThread
                  parentMessage={activeThread}
                  onClose={() => setActiveThread(null)}
                  chatId={currentChat.type === "dm" ? currentChat.clerkId ?? "" : currentChat.id}
                  channelType={currentChat.type}
                  activeEmojiPicker={activeEmojiPicker}
                  setActiveEmojiPicker={setActiveEmojiPicker}
                />
              </div>
            )}
          </div>
        ))}

        <div ref={bottomLoader} className="h-16" />
      </ScrollArea>
      
      <form onSubmit={handleSendMessage} className="flex p-4 bg-gray-300">
        <Input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          className={`flex-grow ${colors.input}`}
          placeholder={`Message ${currentChat.type === "channel" ? "#" : "@"}${currentChat.name}`}
        />
        <Button type="submit" className={`${colors.primary} ml-2`}>
          Send
        </Button>
      </form>
    </div>
  )
}
