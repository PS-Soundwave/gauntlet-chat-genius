"use client"

import { Sidebar } from "@/components/Sidebar"
import ChatInterface from "@/components/ChatInterface"
import { ChannelProvider } from "@/contexts/ChannelContext"

export default function Home() {
  return (
    <ChannelProvider>
      <main className="flex min-h-screen">
        <Sidebar />
        <div className="flex-grow">
          <ChatInterface />
        </div>
      </main>
    </ChannelProvider>
  )
}

