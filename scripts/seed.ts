import { db } from '../src/db'
import { messages } from '../src/db/schema'

const MESSAGES_PER_CHANNEL = 1000
const CHANNELS = ['1', '2', '3', '4', '5']
const LOREM = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
  "Nulla facilisi. Mauris blandit aliquet elit, eget tincidunt nibh.",
  "Vestibulum ante ipsum primis in faucibus orci luctus.",
  "Fusce vulputate eleifend sapien. Vestibulum purus quam.",
  "Nullam accumsan lorem in dui. Cras ultricies mi eu turpis.",
  "Donec vitae sapien ut libero venenatis faucibus."
]

async function seed() {
  console.log('🌱 Seeding database...')

  for (const channelId of CHANNELS) {
    console.log(`📝 Adding messages to channel ${channelId}...`)
    
    const messagePromises = Array.from({ length: MESSAGES_PER_CHANNEL }, async (_, i) => {
      const randomMessage = LOREM[Math.floor(Math.random() * LOREM.length)]
      const messageNumber = i + 1
      
      return db.insert(messages).values({
        chatId: channelId,
        content: `Message ${messageNumber}: ${randomMessage}`
      })
    })

    await Promise.all(messagePromises)
  }

  console.log('✅ Seeding complete!')
  process.exit(0)
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error)
  process.exit(1)
}) 