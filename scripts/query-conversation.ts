/*import { answerWithContext } from '../src/lib/rag'
import dotenv from 'dotenv'
import readline from 'readline'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

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

async function queryConversation() {
  const rl = createReadlineInterface()

  try {
    while (true) {
      const query = await askQuestion(rl, '\nEnter your question (or type "exit" to quit):\n> ')
      
      if (query.toLowerCase() === 'exit') {
        console.log('\nGoodbye!')
        break
      }

      console.log('\nSearching and generating response...')
      const { answer, relevantMessages } = await answerWithContext(query)

      console.log('\nRelevant messages from the conversation:')
      console.log('----------------------------------------')
      relevantMessages.forEach(msg => {
        console.log(`[${new Date(msg.createdAt).toLocaleString()}] ${msg.userId}:`)
        console.log(`${msg.content}`)
        console.log(`(relevance score: ${msg.score.toFixed(3)})`)
        console.log('----------------------------------------')
      })

      console.log('\nAI Response:')
      console.log('----------------------------------------')
      console.log(answer)
      console.log('----------------------------------------')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    rl.close()
  }
}

// Run the query script
queryConversation() */