import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { colors } from "@/utils/colors"
import { Message } from "./Message"
import { useSocket } from "@/contexts/SocketContext"
import { Upload, Paperclip } from 'lucide-react'

type ThreadMessage = {
  id: number
  content: string
  createdAt: Date
  username: string
  reactions?: {
    emoji: string
    username: string
  }[]
  attachments?: {
    key: string
    filename: string
    contentType: string
    size: number
  }[]
}

type Attachment = {
  key: string
  filename: string
  contentType: string
  size: number
}

type MessageThreadProps = {
  parentMessage: ThreadMessage
  onClose: () => void
  channel: { type: "dm", id: string } | { type: "channel", id: number }
  activeEmojiPicker: number | null
  setActiveEmojiPicker: (messageId: number | null) => void,
  userTable: { [key: string]: string }
}

export function MessageThread({ userTable, parentMessage, onClose, channel, activeEmojiPicker, setActiveEmojiPicker }: MessageThreadProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { socket } = useSocket()
  
  useEffect(() => {
    if (socket) {
        if (channel.type === "dm") {
            socket.emit("join-dm-thread", { messageId: parentMessage.id, username: channel.id })
        } else {
            socket.emit("join-thread", { messageId: parentMessage.id, channelId: channel.id })
        }

        socket.on("thread-history", (data: { messageId: number, messages: ThreadMessage[] }) => {
            setMessages(data.messages)
        })

        socket.on("new-thread-message", (message: ThreadMessage) => {
            setMessages(prev => [...prev, message])
        })

        return () => {
            if (socket) {
                if (channel.type === "dm") {
                    socket.emit("leave-dm-thread", { messageId: parentMessage.id, username: channel.id })
                } else {
                    socket.emit("leave-thread", parentMessage.id)
                }
                socket.off("thread-history")
                socket.off("new-thread-message")
            }
        }
    }
  }, [socket, parentMessage.id, channel])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    setIsUploading(true)
    try {
      const newAttachments = await Promise.all(
        Array.from(files).map(async (file) => {
          // Get presigned URL
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type
            })
          })

          if (!res.ok) {
            throw new Error(`Failed to get upload URL: ${res.statusText}`)
          }

          const { url, fields, key } = await res.json()

          // Create form data for upload
          const formData = new FormData()
          Object.entries(fields).forEach(([key, value]) => {
            formData.append(key, value as string)
          })
          formData.append('file', file)

          // Upload to S3
          await fetch(url, {
            method: 'POST',
            body: formData
          })

          // If we get here, upload was successful
          return {
            key: key,
            filename: file.name,
            contentType: file.type,
            size: file.size
          }
        })
      )

      setAttachments(prev => [...prev, ...newAttachments])
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if ((inputMessage.trim() || attachments.length) && socket) {
        if (channel.type === "dm") {
            socket.emit("send-dm", {
                username: channel.id,
                content: inputMessage,
                parentId: parentMessage.id,
                attachments
            })
        } else {
            socket.emit("send-message", {
                channelId: channel.id,
                content: inputMessage,
                parentId: parentMessage.id,
                attachments
            })
        }
        setInputMessage("")
        setAttachments([])
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
              username={userTable[message.username]}
              content={message.content}
              className="mb-4"
              reactions={message.reactions}
              messageId={message.id}
              activeEmojiPicker={activeEmojiPicker}
              setActiveEmojiPicker={setActiveEmojiPicker}
              attachments={message.attachments}
            />
          ))}
        </ScrollArea>

        <form onSubmit={handleSendMessage} className="p-4 border-t">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1">
                  <span className="text-sm truncate max-w-[200px]">{file.filename}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Reply in thread..."
              className="mb-2"
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Upload className="animate-bounce" /> : <Paperclip />}
            </Button>
          </div>
          <Button type="submit" className={colors.primary} size="sm">Reply</Button>
        </form>
      </div>
    </div>
  )
} 