import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { colors } from "@/utils/colors"
import { useChannel } from "@/contexts/ChannelContext"
import { useSocket } from "@/contexts/SocketContext"
import { useEffect, useState } from "react"

type Channel = {
  id: number
  name: string
}

export function Sidebar() {
  const { currentChat, setCurrentChat, connectedUsers, currentUser } = useChannel()
  const { socket } = useSocket()
  const [channels, setChannels] = useState<Channel[]>([])

  useEffect(() => {
    if (!socket) return

    socket.on("channels", (serverChannels: Channel[]) => {
      console.log("serverChannels", serverChannels)
      setChannels(serverChannels)
    })

    socket.emit("get-channels")

    return () => {
      socket.off("channels")
    }
  }, [socket])

  const dms = connectedUsers
    .filter(user => user.id !== currentUser?.id)
    .map(user => ({
      name: user.username,
      clerkId: user.id,
      type: "dm" as const
    }))

  return (
    <div className={`${colors.secondary} w-64 h-screen p-4 flex flex-col`}>
      <h2 className="text-xl font-semibold mb-4">ChatGenius</h2>
      <ScrollArea className="flex-grow">
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Channels</h3>
          {channels.map((channel) => (
            <Button
              key={channel.id}
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
          ))}
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
    </div>
  )
}

