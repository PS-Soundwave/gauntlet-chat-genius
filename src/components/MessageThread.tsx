import { useState, useEffect } from "react"
import { Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { colors } from "@/utils/colors"

type ThreadMessage = {
  id: number
  content: string
  createdAt: Date
  username: string
}

type MessageThreadProps = {
  socket: Socket | null
  parentMessage: ThreadMessage
  onClose: () => void
  chatId: string
}

export function MessageThread({ socket, parentMessage, onClose, chatId }: MessageThreadProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")

  useEffect(() => {
    if (socket) {
        socket.emit("join-thread", { messageId: parentMessage.id })

        socket.on("thread-history", (data: { messageId: number, messages: ThreadMessage[] }) => {
        if (data.messageId === parentMessage.id) {
            setMessages(data.messages)
        }
        })

        socket.on("new-thread-message", (message: ThreadMessage) => {
        setMessages(prev => [...prev, message])
        })

        return () => {
        if (socket) {
            socket.emit("leave-thread", parentMessage.id)
            socket.off("thread-history")
            socket.off("new-thread-message")
        }
        }
    }
  }, [socket, parentMessage.id])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputMessage.trim() && socket) {
        console.log("Emitting send-message for thread-", parentMessage.id)
        socket.emit("send-message", {
            chatId,
            content: inputMessage,
            parentId: parentMessage.id
        })
        setInputMessage("")
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="flex flex-col">
        <div className={`${colors.primary} p-2 text-white flex justify-between items-center rounded-t-lg`}>
          <h3 className="font-semibold text-sm">Thread</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        </div>

        <ScrollArea className="h-64 p-4">
          {messages.map((message) => (
            <div key={message.id} className="mb-4">
              <div className="font-semibold text-sm">{message.username}</div>
              <div>{message.content}</div>
            </div>
          ))}
        </ScrollArea>

        <form onSubmit={handleSendMessage} className="p-4 border-t">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Reply in thread..."
            className="mb-2"
          />
          <Button type="submit" className={colors.primary} size="sm">Reply</Button>
        </form>
      </div>
    </div>
  )
} 