import OpenAI from 'openai'
import { generateEmbedding } from './embeddings'
import { messageIndex } from './pinecone'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface RetrievedMessage {
  content: string
  userId: string
  createdAt: string
  score: number
}

export async function answerWithContext(query: string, topK: number = 5): Promise<{
  answer: string
  relevantMessages: RetrievedMessage[]
}> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query)

  // Retrieve relevant messages from Pinecone
  const results = await messageIndex.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true
  })

  // Format retrieved messages for context
  const relevantMessages = results.matches
    .filter(match => match.metadata && typeof match.score === 'number')
    .map(match => ({
      content: match.metadata?.content as string,
      userId: match.metadata?.userId as string,
      createdAt: match.metadata?.createdAt as string,
      score: match.score as number
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  // Create a context string from relevant messages
  const contextString = relevantMessages
    .map(msg => `[${new Date(msg.createdAt).toLocaleString()}] ${msg.userId}: ${msg.content}`)
    .join('\n')

  // Generate response using ChatGPT with context
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that answers questions about a conversation history. 
        You should use the provided conversation context to inform your answers, but respond naturally as if you're having a conversation.
        If the context doesn't contain enough information to answer the question confidently, say so.
        When referencing specific messages, you can mention their timestamps or who said them.`
      },
      {
        role: "user",
        content: `Here is some relevant conversation history:

${contextString}

Question: ${query}`
      }
    ],
    temperature: 0.7
  })

  return {
    answer: response.choices[0].message.content || "Sorry, I couldn't generate a response.",
    relevantMessages
  }
}

export async function searchConversation(query: string, topK: number = 5): Promise<RetrievedMessage[]> {
  const queryEmbedding = await generateEmbedding(query)
  
  const results = await messageIndex.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true
  })

  return results.matches
    .filter(match => match.metadata && typeof match.score === 'number')
    .map(match => ({
      content: match.metadata?.content as string,
      userId: match.metadata?.userId as string,
      createdAt: match.metadata?.createdAt as string,
      score: match.score as number
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
} 