"use client"

import { useAuth } from '@clerk/nextjs'
import { redirect, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

type SocketContextType = {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const { getToken } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const router = useRouter()

  useEffect(() => {
    // *internal screaming*
    let componentIsMounted = true
    let componentDidMount = false

    const initSocket = async () => {
        await fetch("/api/socket")
        if (!componentIsMounted) return

        const newSocket = io("http://localhost:3001", {
            transports: ['websocket'],
            upgrade: false
        })

        newSocket.on("connect", async () => {
            console.log("Socket connected:", newSocket.id)
            newSocket.emit("auth", {
                token: await getToken()
            })
        })

        newSocket.on("auth-success", () => {
            setIsConnected(true)
        })

        newSocket.on("auth-fail", () => {
            router.push("/duplicate-session")
        })

        newSocket.on("disconnect", () => {
            console.log("Socket disconnected:", newSocket.id)
            setIsConnected(false)
        })

        setSocket(newSocket)
        componentDidMount = true
    }

    console.log("Socket effect running")
    initSocket()

    return () => {
      componentIsMounted = false
      if (!componentDidMount) return
      console.log("Cleanup running, disconnecting socket:", socket)
      socket?.disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket: socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
} 