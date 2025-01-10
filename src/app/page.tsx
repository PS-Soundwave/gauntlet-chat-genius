"use client"

import { Sidebar } from "@/components/Sidebar"
import ChatInterface from "@/components/ChatInterface"
import { ChannelProvider } from "@/contexts/ChannelContext"
import { SocketProvider } from "@/contexts/SocketContext"
import { ConnectedUsers } from "@/components/ConnectedUsers"
import { RedirectToSignIn } from "@clerk/nextjs"
import { useUser } from "@clerk/nextjs"

export default function Home() {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) {
    return <div>Loading...</div>
  }

  if (!isSignedIn) {
    return (
      <RedirectToSignIn />
    )
  }

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

