import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { OpenAI } from "openai"
import { generateEmbedding } from "./embeddings"
import { messageIndex } from "./pinecone"
import { Document } from "@langchain/core/documents"

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function processPdf(buffer: File) {
  // Load and parse PDF
  const loader = new PDFLoader(buffer)
  const docs = await loader.load()
  
  // Combine all pages into one text
  const fullText = docs.map((doc: Document) => doc.pageContent).join('\n')
  
  // Generate summary using GPT-4
  const summary = await summarizePdf(fullText)
  
  // Split summary into chunks for vectorization
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  })
  const chunks = await splitter.createDocuments([summary])
  
  // Generate embeddings and store in Pinecone
  await Promise.all(chunks.map(async (chunk: Document) => {
    const embedding = await generateEmbedding(chunk.pageContent)
    await messageIndex.upsert([{
      id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      values: embedding,
      metadata: {
        content: chunk.pageContent,
        type: 'pdf_summary',
        createdAt: new Date().toISOString()
      }
    }])
  }))

  return summary
}

async function summarizePdf(text: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that creates concise but comprehensive summaries of PDF documents. Focus on the main points and key information."
      },
      {
        role: "user",
        content: `Please summarize the following PDF content:\n\n${text}`
      }
    ],
    temperature: 0.3
  })

  return response.choices[0].message.content || "Could not generate summary."
} 