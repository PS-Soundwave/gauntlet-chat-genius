import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { colors } from "@/utils/colors"
import { Message } from "./Message"
import { useSocket } from "@/contexts/SocketContext"

type ThreadMessage = {
    id: number
    content: string
    createdAt: Date
    username: string
    reactions?: {
        emoji: string
        username: string
      }[]
}

type MessageThreadProps = {
  parentMessage: ThreadMessage
  onClose: () => void
  chatId: string
  channelType: ChannelType
}

type ChannelType = "dm" | "channel"

export function MessageThread({ parentMessage, onClose, chatId, channelType }: MessageThreadProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const { socket } = useSocket()
  
  useEffect(() => {
    if (socket) {
        if (channelType === "dm") {
            socket.emit("join-dm-thread", { messageId: parentMessage.id, username: chatId })
        } else {
            socket.emit("join-thread", { messageId: parentMessage.id, chatId })
        }

        socket.on("thread-history", (data: { messageId: number, messages: ThreadMessage[] }) => {
            setMessages(data.messages)
        })

        socket.on("new-thread-message", (message: ThreadMessage) => {
            setMessages(prev => [...prev, message])
        })

        return () => {
            if (socket) {
                if (channelType === "dm") {
                    socket.emit("leave-dm-thread", { messageId: parentMessage.id, username: chatId })
                } else {
                    socket.emit("leave-thread", parentMessage.id)
                }
                socket.off("thread-history")
                socket.off("new-thread-message")
            }
        }
    }
  }, [socket, parentMessage.id])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputMessage.trim() && socket) {
        if (channelType === "dm") {
            socket.emit("send-dm", {
                username: chatId,
                content: inputMessage,
                parentId: parentMessage.id
            })
        } else {
            socket.emit("send-message", {
                chatId,
                content: inputMessage,
                parentId: parentMessage.id
            })
        }
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
            <Message
              key={message.id}
              username={message.username}
              content={message.content}
              className="mb-4"
              reactions={message.reactions}
              chatId={chatId}
              messageId={message.id}
              type={channelType}
            />
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