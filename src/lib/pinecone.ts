import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME || !process.env.PINECONE_DOCUMENTS_INDEX_NAME) {
  throw new Error('Required environment variables are not defined')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
})

export const messageIndex = pinecone.index(process.env.PINECONE_INDEX_NAME)
export const documentIndex = pinecone.index(process.env.PINECONE_DOCUMENTS_INDEX_NAME)

export interface MessageVector {
  id: number
  content: string
  userId: string
  channelId: number,
  createdAt: Date
  embedding: number[]
}

export async function upsertMessage(vector: MessageVector) {
  if (vector.channelId === -1) {
    return
  }

  await messageIndex.upsert([{
    id: vector.id.toString(),
    values: vector.embedding,
    metadata: {
      content: vector.content,
      userId: vector.userId,
      channelId: vector.channelId,
      createdAt: vector.createdAt.toISOString()
    }
  }])
}

export async function queryVectors(queryEmbedding: number[], query: string, topK: number = 5) {
  // First, determine if we should query messages or documents
  const contextType = await determineContextType(queryEmbedding, query)
  
  if (contextType === 'documents') {
    const results = await documentIndex.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true
    })
    return { type: 'documents', matches: results.matches }
  } else {
    const results = await messageIndex.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true
    })
    return { type: 'messages', matches: results.matches }
  }
}

async function determineContextType(queryEmbedding: number[], query: string): Promise<'messages' | 'documents'> {
  // Query both indices with a small topK to determine relevance
  const [messageResults, documentResults] = await Promise.all([
    messageIndex.query({
      vector: queryEmbedding,
      topK: 3
    }),
    documentIndex.query({
      vector: queryEmbedding,
      topK: 3
    })
  ])

  // Calculate average scores for each type
  const messageAvg = messageResults.matches.reduce((acc, m) => acc + (m.score || 0), 0) / messageResults.matches.length
  const documentAvg = documentResults.matches.reduce((acc, m) => acc + (m.score || 0), 0) / documentResults.matches.length

  // Let GPT-4 decide based on the query and relevance scores
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that decides whether to use conversation history or document summaries to answer a query.
        You will receive information about the query and the relevance scores of both types of content.
        You should output a JSON object with two fields:
        - "choice": either "messages" or "documents"
        - "reason": a brief explanation of your decision
        
        Consider:
        1. The nature of the query (is it about conversations or documents?)
        2. The relative relevance scores (how much more relevant is one type over the other?)
        3. The absolute relevance scores (are they high enough to be meaningful?)
        
        Your response must be a valid JSON object that can be parsed.`
      },
      {
        role: "user",
        content: `Query: "${query}"

Message Results:
- Average relevance score: ${messageAvg.toFixed(4)}
- Number of results: ${messageResults.matches.length}

Document Results:
- Average relevance score: ${documentAvg.toFixed(4)}
- Number of results: ${documentResults.matches.length}

Which context type should I use?`
      }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  })

  const decision = JSON.parse(response.choices[0].message.content || '{}')
  
  return decision.choice
} 