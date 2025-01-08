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
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const initSocket = async () => {
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
    }

    initSocket()

    return () => {
      socketRef.current?.disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
} 