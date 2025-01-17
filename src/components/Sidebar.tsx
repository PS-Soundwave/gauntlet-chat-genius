import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { colors } from "@/utils/colors"
import { useChannel } from "@/contexts/ChannelContext"
import { useSocket } from "@/contexts/SocketContext"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"

type Channel = {
  id: number
  name: string
}

export function Sidebar() {
  const { currentChat, setCurrentChat, connectedUsers, currentUser } = useChannel()
  const { socket } = useSocket()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isAddingChannel, setIsAddingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState("")

  useEffect(() => {
    if (!socket) return

    socket.on("channels", (serverChannels: Channel[]) => {
      setChannels(serverChannels)
    })

    console.log("effect running" , socket)
    socket.on("username-changed", () => {
      console.log("success")
      setIsEditingUsername(false)
      setNewUsername("")
    })

    socket.emit("get-channels")

    return () => {
      console.log("off")
      socket.off("channels")
      socket.off("username-changed")
    }
  }, [socket])

  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault()
    if (newChannelName.trim() && socket) {
      socket.emit("add-channel", { name: newChannelName.trim() })
      setNewChannelName("")
      setIsAddingChannel(false)
    }
  }

  const handleRemoveChannel = (channelId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (socket) {
      socket.emit("remove-channel", { channelId })
      if (currentChat?.type === "channel" && currentChat.id === channelId) {
        setCurrentChat(null)
      }
    }
  }

  const handleUsernameChange = (e: React.FormEvent) => {
    e.preventDefault()
    if (newUsername.trim() && socket) {
      socket.emit("change-username", { newUsername: newUsername.trim() })
    }
  }

  const dms = currentUser ? connectedUsers
    .filter(user => user.id !== currentUser?.id)
    .map(user => ({
      name: user.username,
      clerkId: user.id,
      type: "dm" as const
    })) : []

  return (
    <div className={`${colors.secondary} w-64 h-screen p-4 flex flex-col`}>
      <h2 className="text-xl font-semibold mb-4">ChatGenius</h2>
      <ScrollArea className="flex-grow">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold">Channels</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsAddingChannel(true)}
              className="h-6 w-6 p-0"
            >
              +
            </Button>
          </div>

          {isAddingChannel && (
            <form onSubmit={handleAddChannel} className="mb-2">
              <div className="flex gap-2">
                <Input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="Channel name"
                  className="h-8"
                />
                <Button type="submit" size="sm" className="h-8">
                  Add
                </Button>
              </div>
            </form>
          )}

          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center group">
              <Button
                variant="ghost"
                className={`w-full justify-start mb-1 ${
                  currentChat?.type === "channel" && currentChat.id === channel.id ? colors.activeChannel : ""
                }`}
                onClick={() => setCurrentChat({
                  id: channel.id,
                  name: channel.name,
                  type: "channel"
                })}
              >
                # {channel.name}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleRemoveChannel(channel.id, e)}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
        <Separator className="my-2" />
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">AI Query</h3>
          <Button
            variant="ghost"
            className="w-full justify-start mb-1"
            onClick={() => setCurrentChat({
              id: -1,
              name: "AI Assistant",
              type: "channel"
            })}
          >
            🤖 AI Assistant
          </Button>
        </div>
        <Separator className="my-2" />
        <div>
          <h3 className="text-sm font-semibold mb-2">Direct Messages</h3>
          {dms.map((dm) => (
            <Button
              key={dm.clerkId}
              variant="ghost"
              className={`w-full justify-start mb-1 ${
                currentChat?.type === "dm" && currentChat.clerkId === dm.clerkId ? colors.activeChannel : ""
              }`}
              onClick={() => setCurrentChat(dm)}
            >
              @ {dm.name}
            </Button>
          ))}
        </div>
      </ScrollArea>
      <Separator className="my-2" />
      <div className="mt-auto">
        <div className="flex justify-between items-center">
          <div className="text-sm font-semibold">
            {isEditingUsername ? (
              <form onSubmit={handleUsernameChange} className="flex gap-2">
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="New username"
                  className="h-8"
                />
                <Button type="submit" size="sm" className="h-8">
                  Save
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span>@{currentUser?.username}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditingUsername(true)
                    setNewUsername(currentUser?.username || "")
                  }}
                  className="h-6 w-6 p-0"
                >
                  ✏️
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

