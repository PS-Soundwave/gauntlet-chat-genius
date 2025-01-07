import { ScrollArea } from "@/components/ui/scroll-area"
import { colors } from "@/utils/colors"
import { useChannel } from "@/contexts/ChannelContext"

export function ConnectedUsers() {
  const { connectedUsers } = useChannel()

  return (
    <div className={`${colors.secondary} w-64 h-screen p-4 flex flex-col`}>
      <h2 className="text-xl font-semibold mb-4">Connected Users</h2>
      <ScrollArea className="flex-grow">
        {connectedUsers.map((user) => (
          <div
            key={user.username}
            className="mb-2 p-2 rounded-md hover:bg-gray-300 transition-colors"
          >
            {user.username}
          </div>
        ))}
      </ScrollArea>
    </div>
  )
} 