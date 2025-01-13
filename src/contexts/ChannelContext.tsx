"use client"

import React, { createContext, useState, useContext, SetStateAction } from "react"

type ChatItem = {
  name: string
  clerkId: string
  type: "dm"
} | {
  type: "channel"
  id: number
  name: string
}

type ChannelContextType = {
  currentChat: ChatItem | null
  setCurrentChat: (chat: SetStateAction<ChatItem | null>) => void
  connectedUsers: { id: string; username: string }[]
  setConnectedUsers: (users: SetStateAction<{ id: string; username: string }[]>) => void
  currentUser: { username: string, id: string } | null
  setCurrentUser: (user: SetStateAction<{ username: string, id: string } | null>) => void
}

const ChannelContext = createContext<ChannelContextType | undefined>(undefined)

export const useChannel = () => {
  const context = useContext(ChannelContext)
  if (!context) {
    throw new Error("useChannel must be used within a ChannelProvider")
  }
  return context
}

export const ChannelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentChat, setCurrentChat] = useState<ChatItem | null>(null)
  const [connectedUsers, setConnectedUsers] = useState<{ id: string; username: string }[]>([])
  const [currentUser, setCurrentUser] = useState<{ username: string, id: string } | null>(null)

  return (
    <ChannelContext.Provider value={{ 
      currentChat, 
      setCurrentChat, 
      connectedUsers, 
      setConnectedUsers,
      currentUser,
      setCurrentUser 
    }}>
      {children}
    </ChannelContext.Provider>
  )
}
