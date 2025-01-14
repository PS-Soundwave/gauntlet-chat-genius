import { Pinecone } from '@pinecone-database/pinecone'

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not defined')
}

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('PINECONE_INDEX_NAME is not defined')
}

export const CHANNEL_TO_VECTORIZE = 1 // The hardcoded channel ID to vectorize
export const QUERY_CHANNEL = 2 // The hardcoded channel ID for queries

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
})

export const messageIndex = pinecone.index(process.env.PINECONE_INDEX_NAME)

export interface MessageVector {
  id: number
  content: string
  userId: string
  channelId: number
  createdAt: Date
  parentId: number | null
  embedding: number[]
}

export async function upsertMessage(vector: MessageVector) {
  if (vector.channelId !== CHANNEL_TO_VECTORIZE) {
    return
  }

  await messageIndex.upsert([{
    id: vector.id.toString(),
    values: vector.embedding,
    metadata: {
      content: vector.content,
      userId: vector.userId,
      channelId: vector.channelId,
      createdAt: vector.createdAt.toISOString(),
      parentId: vector.parentId?.toString() ?? "null"
    }
  }])
}

export async function queryMessages(queryEmbedding: number[], topK: number = 5) {
  const results = await messageIndex.query({
    vector: queryEmbedding,
    topK,
    filter: {
      channelId: { $eq: CHANNEL_TO_VECTORIZE }
    }
  })

  return results.matches
} 