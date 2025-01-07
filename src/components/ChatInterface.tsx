"use client"

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react"
import { io, Socket } from "socket.io-client"
import { colors } from "@/utils/colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useChannel } from "@/contexts/ChannelContext"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useInView } from 'react-intersection-observer'

type Message = {
  id?: number
  content: string
  createdAt: Date
  username: string
}

export default function ChatInterface() {
  const socketRef = useRef<Socket | null>(null)
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { currentChat, setConnectedUsers, setCurrentUser } = useChannel()
  const [messages, setMessages] = useState<{ [chatId: string]: Message[] }>({})
  const [hasMore, setHasMore] = useState<{ [chatId: string]: boolean }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [inputMessage, setInputMessage] = useState("")
  const [resetIsLoading, setResetIsLoading] = useState(false);
  const [scrollAnchor, setScrollAnchor] = useState<{
    messageId: number | null;
    top: number | null;
  } | null>(null);
  const [username, setUsername] = useState<string>("")

  const { ref: topLoader, inView: isTopVisible } = useInView({
    threshold: 0,
    rootMargin: '-100px 0px 0px 0px',
  })
  const { ref: bottomLoader, inView: isBottomVisible } = useInView({
    threshold: 0,
    rootMargin: '0px 0px -100px 0px',
  })

  const loadMoreMessagesBack = useCallback(() => {
    if (isLoading) return

    const oldestMessage = messages[currentChat.id]?.[0]
    
    if (oldestMessage) {
      setIsLoading(true)

      socketRef.current?.emit("chat-history-back", {
        chatId: currentChat.id,
        cursor: {
          date: oldestMessage.createdAt,
          id: oldestMessage.id
        }
      })
    }
  }, [currentChat.id, messages, hasMore, isLoading])

  const loadMoreMessagesForward = useCallback(() => {
    if (isLoading) return

    const newestMessage = messages[currentChat.id]?.at(-1)
    
    if (newestMessage) {
      setIsLoading(true)

      socketRef.current?.emit("chat-history-forward", {
        chatId: currentChat.id,
        cursor: {
        date: newestMessage.createdAt,
        id: newestMessage.id
        }
      })
    }
  }, [currentChat.id, messages, hasMore, isLoading])

  const socketInitializer = useCallback(async () => {
    await fetch("/api/socket")
    socketRef.current = io("http://localhost:3001", {
      transports: ['websocket'],
      upgrade: false
    })

    socketRef.current.on("connect", () => {
      console.log("Connected to WebSocket")
      setIsConnected(true)
    })

    socketRef.current.on("disconnect", () => {
      setIsConnected(false)
    })

    socketRef.current.on("users-updated", (users: { id: string; username: string }[]) => {
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

    socketRef.current.on("chat-history", (data: { 
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

    socketRef.current.on("new-message", (message: { chatId: string, content: string, username:string }) => {
      console.log("new-message", message)
      setMessages(prevMessages => ({
        ...prevMessages,
        [message.chatId]: [...(prevMessages[message.chatId] || []), {
          id: Date.now(),
          content: message.content,
          createdAt: new Date(),
          username: message.username
        }]
      }))
    })

    socketRef.current.on("user-assigned", (data: { username: string, id: string }) => {
      setCurrentUser({ username: data.username })
    })
  }, [setConnectedUsers])

  useEffect(() => {
    socketInitializer()
    return () => {
      socketRef.current?.disconnect()
    }
  }, [socketInitializer])

  useEffect(() => {
    if (socketRef.current && isConnected) {
      if (currentChat.type === "dm") {
        socketRef.current.emit("join-dm", {
          username: currentChat.name
        })
      } else {
        socketRef.current.emit("join-chat", {
          chatId: currentChat.id,
          cursor: undefined
        })
      }
      return () => {
        socketRef.current?.emit("leave-chat", currentChat.id)
      }
    }
  }, [currentChat, isConnected])

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
    if (inputMessage.trim() && socketRef.current && isConnected) {
      const message = { chatId: currentChat.id, content: inputMessage }
      socketRef.current.emit("send-message", message)
      setInputMessage("")
    }
  }

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
        
        {messages[currentChat.id]?.map((message, index) => (
          <div 
            key={index}
            className="mb-2 p-2 rounded bg-white message-item"
          >
            <div className="font-semibold text-sm text-gray-600">
              {message.username}
            </div>
            <div>{message.content}</div>
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
