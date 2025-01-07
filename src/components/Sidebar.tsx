import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { colors } from "@/utils/colors"
import { useChannel } from "@/contexts/ChannelContext"

type ChatItem = {
  id: string
  name: string
  type: "channel" | "dm"
}

const channels: ChatItem[] = [
  { id: "1", name: "general", type: "channel" },
  { id: "2", name: "random", type: "channel" },
  { id: "3", name: "project-a", type: "channel" },
  { id: "4", name: "project-b", type: "channel" },
  { id: "5", name: "announcements", type: "channel" },
]

const dms: ChatItem[] = [
  { id: "dm1", name: "Alice", type: "dm" },
  { id: "dm2", name: "Bob", type: "dm" },
  { id: "dm3", name: "Charlie", type: "dm" },
]

export function Sidebar() {
  const { currentChat, setCurrentChat } = useChannel()

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
                currentChat.id === channel.id ? colors.activeChannel : ""
              }`}
              onClick={() => setCurrentChat(channel)}
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
              key={dm.id}
              variant="ghost"
              className={`w-full justify-start mb-1 ${
                currentChat.id === dm.id ? colors.activeChannel : ""
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

