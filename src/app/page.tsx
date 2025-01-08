"use client"

import { Sidebar } from "@/components/Sidebar"
import ChatInterface from "@/components/ChatInterface"
import { ChannelProvider } from "@/contexts/ChannelContext"
import { SocketProvider } from "@/contexts/SocketContext"
import { ConnectedUsers } from "@/components/ConnectedUsers"

export default function Home() {
  return (
    <SocketProvider>
      <ChannelProvider>
        <main className="flex min-h-screen">
          <Sidebar />
          <div className="flex-grow">
            <ChatInterface />
          </div>
          <ConnectedUsers />
        </main>
      </ChannelProvider>
    </SocketProvider>
  )
}

