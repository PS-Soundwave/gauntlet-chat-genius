import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
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
  const socketRef = useRef<Socket | null>(null)
  const router = useRouter()

  useEffect(() => {
    // *internal screaming*
    let socketInitialized = false
    let shouldSocketInitialize = true

    const initSocket = async () => {
        await fetch("/api/socket")
        if (!shouldSocketInitialize) return
        
        socketRef.current = io(process.env.NEXT_PUBLIC_WEBSOCKET_ORIGIN, {
            transports: ['websocket'],
            path: "/ws/"
        })

        socketRef.current.on("connect", async () => {
            socketRef.current?.emit("auth", {
                token: await getToken()
            })
        })

        socketRef.current.on("auth-success", () => {
            setIsConnected(true)
        })

        socketRef.current.on("auth-fail", () => {
            router.push("/duplicate-session")
        })

        socketRef.current.on("disconnect", () => {
            setIsConnected(false)
        })

        socketInitialized = true
    }

    initSocket()

    return () => {
      shouldSocketInitialize = false
      if (!socketInitialized) return
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [getToken, router])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
} 