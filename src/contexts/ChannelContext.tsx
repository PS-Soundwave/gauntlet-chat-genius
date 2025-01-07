"use client"

import React, { createContext, useState, useContext } from "react"

type ChatItem = {
  id: string
  name: string
  type: "channel" | "dm"
}

type ChannelContextType = {
  currentChat: ChatItem
  setCurrentChat: (chat: ChatItem) => void
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
  const [currentChat, setCurrentChat] = useState<ChatItem>({ id: "1", name: "general", type: "channel" })

  return (
    <ChannelContext.Provider value={{ currentChat, setCurrentChat }}>
      {children}
    </ChannelContext.Provider>
  )
}

