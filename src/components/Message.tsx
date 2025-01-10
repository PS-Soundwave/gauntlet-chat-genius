import React, { useEffect, useState } from 'react'
import { useSocket } from '@/contexts/SocketContext'
import { useChannel } from '@/contexts/ChannelContext'

type MessageProps = {
  username: string
  content: string
  onClick?: () => void
  className?: string
  reactions?: {
    emoji: string
    username: string
  }[]
  messageId: number
  activeEmojiPicker: number | null
  setActiveEmojiPicker: (messageId: number | null) => void
}

const commonEmojis = ["👍", "👎", "❤️", "😂", "😮", "😢", "🎉", "💯", "🔥"]

export function Message({ 
  username, 
  content, 
  onClick, 
  className = "",
  reactions: initialReactions = [],
  messageId,
  activeEmojiPicker,
  setActiveEmojiPicker
}: MessageProps) {
  const { socket } = useSocket()
  const { currentUser } = useChannel()
  const [reactions, setReactions] = useState(initialReactions)

  const showEmojiPicker = activeEmojiPicker === messageId

  const reactionTable = reactions.reduce((acc: { [key: string]: { count: number, userReacted: boolean } }, reaction) => {
    acc[reaction.emoji] = {
        count: (acc[reaction.emoji]?.count || 0) + 1,
        userReacted: acc[reaction.emoji]?.userReacted || reaction.username === currentUser?.username
    }
    return acc
  }, {})

  useEffect(() => {
    if (!socket) return

    const listener = (data: {
        messageId: number
        chatId: string
        reactions: {
          emoji: string
          username: string
        }[]
      }) => {
        if (messageId === data.messageId) {
            setReactions(data.reactions)
        }
    }
    socket.on("reaction-updated", listener)

    return () => {
      socket.off("reaction-updated", listener)
    }
  }, [socket])

  const handleReaction = (emoji: string) => {
    if (!socket) return

    socket.emit("react-to-message", {
      messageId,
      emoji
    })
  }

  return (
    <div 
      className={`relative mb-2 p-2 rounded bg-white hover:bg-gray-50 ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="font-semibold text-sm text-gray-600">
        {username}
      </div>
      <div>{content}</div>
      
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(reactionTable).map(([emoji, { count, userReacted }]) => (
          <button
            key={emoji}
            onClick={(e) => {
              e.stopPropagation()
              handleReaction(emoji)
            }}
            className={`text-xs px-2 py-1 rounded-full ${
              userReacted ? 'bg-blue-100' : 'bg-gray-100'
            } hover:bg-blue-200 transition-colors`}
          >
            {emoji} {count}
          </button>
        ))}
        
        <button
          onClick={(e) => {
            e.stopPropagation()
            setActiveEmojiPicker(showEmojiPicker ? null : messageId)
          }}
          className="text-xs px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200"
        >
          +
        </button>
      </div>
      
      {showEmojiPicker && (
        <div 
          className="absolute mt-1 bg-white shadow-lg rounded-lg p-2 flex gap-1 z-10"
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {commonEmojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                handleReaction(emoji)
                setActiveEmojiPicker(null)
              }}
              className="hover:bg-gray-100 p-1 rounded"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 