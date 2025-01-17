import OpenAI from 'openai'
import { generateEmbedding } from '../src/lib/embeddings'
import { upsertMessage } from '../src/lib/pinecone'
import readline from 'readline'

const START_ID = 200
const USER_1 = "Raj"
const USER_2 = "Aki"
const USER_1_ID = "user_jkl765"
const USER_2_ID = "user_mno876"

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface Message {
  role: 'user1' | 'user2'
  content: string
}

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
}

async function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

async function generateConversation(): Promise<Message[]> {
  const prompt = `Generate a detailed instant message conversation between ${USER_1} and ${USER_2} discussing a complex software project. 
The conversation should span multiple days and cover various aspects of the project including:
- Initial project planning and requirements
- Technical architecture discussions
- Timeline and milestone planning
- Challenges and problem-solving
- Code review feedback
- Integration with other teams
- Testing strategy
- Deployment planning

Make the conversation natural and include:
- Technical details and specific examples
- References to previous discussions
- Links to (fictional) documents or pull requests
- Mentions of meetings and other team members
- Some casual/friendly banter mixed in
- Status updates and progress reports

Format the response as a JSON array of objects named "conversation", where each object has:
- role: either "user1" (${USER_1}) or "user2" (${USER_2})
- content: the message text

The conversation should be about 50-60 messages long to show a good progression of the project discussion.

Remember: the conversation is between ${USER_1} and ${USER_2}.`

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { 
        role: "system", 
        content: "You are a helpful assistant that generates realistic workplace conversations. Include specific technical details and maintain consistent context throughout the conversation. Make sure the conversation flows naturally and shows progression over time." 
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9 // Increase creativity while maintaining coherence
  })

  const conversation = JSON.parse(response.choices[0].message.content || '[]')
  return conversation
}

async function displayConversation(conversation: Message[]) {
  let lastRole = ''
  
  if (!conversation.forEach) {
    console.log(conversation)
    return
  }

  conversation.forEach((msg: Message) => {
    if (lastRole && lastRole !== msg.role) {
      console.log('')
    }
    console.log(`${msg.role === 'user1' ? 'Sarah' : 'Mike'}: ${msg.content}`)
    lastRole = msg.role
  })
  console.log(`\nTotal messages: ${conversation.length}`)
}

async function vectorizeConversation(conversation: { conversation: Message[] }) {
  console.log('\nVectorizing and storing messages...')
  const startTime = Date.now() - (24 * 60 * 60 * 1000)

  const convArray = conversation.conversation;
  
  for (let i = 0; i < convArray.length; i++) {
    const msg = convArray[i]
    const embedding = await generateEmbedding(msg.content)
    
    await upsertMessage({
      id: i + 1 + START_ID,
      content: msg.content,
      userId: msg.role === 'user1' ? USER_1_ID : USER_2_ID,
      channelId: 1,
      createdAt: new Date(startTime + i * 15 * 60 * 1000),
      embedding
    })
    
    console.log(`Stored message ${i + 1}/${convArray.length}`)
  }
  
  console.log('\nSeeding completed successfully!')
}

async function seedConversation() {
  const rl = createReadlineInterface()

  try {
    while (true) {
      console.log('Generating conversation...\n')
      const conversation = await generateConversation()
      
      console.log('Generated conversation:')
      await displayConversation(conversation)
      
      const answer = await askQuestion(rl, '\nWould you like to:\n1. Vectorize and store this conversation\n2. Generate a new conversation\n3. Exit\nEnter your choice (1/2/3): ')
      
      switch (answer.trim()) {
        case '1':
          await vectorizeConversation(conversation as unknown as { conversation: Message[] })
          rl.close()
          return
        case '2':
          console.log('\nGenerating a new conversation...')
          continue
        case '3':
          console.log('\nExiting without storing the conversation.')
          rl.close()
          return
        default:
          console.log('\nInvalid choice. Please try again.')
          continue
      }
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    rl.close()
  }
}

// Run the seeding script
seedConversation() 