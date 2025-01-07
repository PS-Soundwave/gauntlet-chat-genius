"use client"

import { Sidebar } from "@/components/Sidebar"
import ChatInterface from "@/components/ChatInterface"
import { ChannelProvider } from "@/contexts/ChannelContext"
import { ConnectedUsers } from "@/components/ConnectedUsers"

export default function Home() {
  return (
    <ChannelProvider>
      <main className="flex min-h-screen">
        <Sidebar />
        <div className="flex-grow">
          <ChatInterface />
        </div>
        <ConnectedUsers />
      </main>
    </ChannelProvider>
  )
}

