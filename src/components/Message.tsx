import React, { useEffect, useState } from 'react'
import { useSocket } from '@/contexts/SocketContext'
import { useChannel } from '@/contexts/ChannelContext'

type MessageProps = {
  username: string
  content: string
  onClick?: () => void
  replyCount?: number
  className?: string
  chatId: string
  reactions?: {
    emoji: string
    username: string
  }[]
  messageId: number
  parentId?: number
  type: 'channel' | 'dm'
}

const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉"]

export function Message({ 
  username, 
  content, 
  onClick, 
  replyCount, 
  className = "",
  chatId,
  parentId,
  type,
  reactions: initialReactions = [],
  messageId
}: MessageProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const { socket } = useSocket()
  const { currentUser } = useChannel()
  const [reactions, setReactions] = useState(initialReactions)

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
      emoji,
      chatId,
      parentId,
      type
    })
  }

  return (
    <div 
      className={`mb-2 p-2 rounded bg-white hover:bg-gray-50 ${onClick ? "cursor-pointer" : ""} ${className}`}
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
            setShowEmojiPicker(!showEmojiPicker)
          }}
          className="text-xs px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200"
        >
          +
        </button>
      </div>
      
      {showEmojiPicker && (
        <div 
          className="absolute mt-1 bg-white shadow-lg rounded-lg p-2 flex gap-1"
          onClick={e => e.stopPropagation()}
        >
          {commonEmojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                handleReaction(emoji)
                setShowEmojiPicker(false)
              }}
              className="hover:bg-gray-100 p-1 rounded"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {replyCount && replyCount > 0 && (
        <div className="text-sm text-gray-500 mt-1">
          {replyCount} replies
        </div>
      )}
    </div>
  )
} 