import OpenAI from 'openai'
import dotenv from 'dotenv'

if (process.env.NODE_ENV !== 'production') {
   dotenv.config({ path: '.env.local' })
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
    encoding_format: "float"
  })

  return response.data[0].embedding
} 