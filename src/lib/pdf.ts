import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { OpenAI } from "openai"
import { generateEmbedding } from "./embeddings"
import { documentIndex } from "./pinecone"
import { Document } from "@langchain/core/documents"

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function processPdf(buffer: File, fileKey: string, filename: string) {
  // Load and parse PDF
  const loader = new PDFLoader(buffer)
  const docs = await loader.load()
  
  // Combine all pages into one text
  const fullText = docs.map((doc: Document) => doc.pageContent).join('\n')

  const pdfSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 250000,
    chunkOverlap: 50000,
  })
  const pdfChunks = await pdfSplitter.createDocuments([fullText])
  
  pdfChunks.forEach(async (chunk: Document, outerIndex) => {
    // Generate summary using GPT-4
    const summary = await summarizePdf(chunk.pageContent)
    
    // Split summary into chunks for vectorization
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    })
    const chunks = await splitter.createDocuments([summary])
  
    // Generate embeddings and store in Pinecone
    await Promise.all(chunks.map(async (chunk: Document, index: number) => {
        const embedding = await generateEmbedding(chunk.pageContent)
        await documentIndex.upsert([{
        id: `${fileKey}-chunk-${outerIndex}-${index}`,
        values: embedding,
        metadata: {
            content: chunk.pageContent,
            type: 'pdf_summary',
            fileKey: fileKey,
            filename: filename,
            createdAt: new Date().toISOString()
        }
        }])
    }))
  })
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