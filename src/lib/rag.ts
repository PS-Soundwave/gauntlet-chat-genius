import OpenAI from 'openai'
import { generateEmbedding } from './embeddings'
import { queryVectors } from './pinecone'

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
  channelId?: number
}

interface RetrievedDocument {
  content: string
  type: string
  fileKey: string
  createdAt: string
  score: number
}

export async function answerWithContext(query: string, topK: number = 5): Promise<{
  answer: string
  relevantMessages?: RetrievedMessage[]
  relevantDocuments?: RetrievedDocument[]
  attachments?: string[]
}> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query)

  // Retrieve relevant vectors from Pinecone
  const results = await queryVectors(queryEmbedding, query, topK)


  if (results.type === 'messages') {
    // Format retrieved messages
    const relevantMessages = results.matches
      .filter(match => match.metadata && typeof match.score === 'number')
      .map(match => ({
        content: match.metadata?.content as string,
        userId: match.metadata?.userId as string,
        createdAt: match.metadata?.createdAt as string,
        channelId: match.metadata?.channelId as number,
        score: match.score as number
      }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    // Create a context string from messages
    const contextString = relevantMessages
      .map(msg => `[${new Date(msg.createdAt).toLocaleString()}, Channel: ${msg.channelId}] ${msg.userId}: ${msg.content}`)
      .join('\n')

    // Generate response using ChatGPT with message context
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
    }
  } else {
    // Format retrieved documents and group by file
    const relevantDocuments = results.matches
      .filter(match => match.metadata && typeof match.score === 'number')
      .map(match => ({
        content: match.metadata?.content as string,
        type: match.metadata?.type as string,
        fileKey: match.metadata?.fileKey as string,
        createdAt: match.metadata?.createdAt as string,
        score: match.score as number
      }))

    // Group chunks by file and combine their content
    const fileGroups = relevantDocuments.reduce((groups, doc) => {
      const key = doc.fileKey
      if (!groups[key]) {
        groups[key] = {
          content: [],
          createdAt: doc.createdAt,
          score: doc.score
        }
      }
      groups[key].content.push(doc.content)
      groups[key].score = Math.max(groups[key].score, doc.score)
      return groups
    }, {} as Record<string, { content: string[], createdAt: string, score: number }>)

    // Create a context string from documents, organized by file
    const contextString = Object.entries(fileGroups)
      .map(([key, { content, createdAt }]) => {
        const filename = key.split('/').pop() || key
        return `[${new Date(createdAt).toLocaleString()}] Document Name: ${filename}\nDocument Key: "${key}"\nSummary:\n${content.join('\n')}`
      })
      .join('\n\n')

    // Generate response using ChatGPT with document context
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that answers questions or fetch documents using document summaries.
          You are able to attach documents from the summaries to your response.
          You should use the provided document summaries to inform your answers, but respond naturally as if you're having a conversation.
          If the user is simply asking for a document, you should return the document key in the attachments array, not summarize the document.
          
          Your response must be a valid JSON object with the following structure:
          {
            "response": "Your natural language response here",
            "attachments": ["key1", "key2"] // List of document keys that you referenced in your response
          }
          
          Guidelines:
          1. If the summaries don't contain enough information to answer confidently, say so in your response
          2. When referencing documents, mention only their filenames naturally in your response, not their keys
          3. Include ALL document keys you referenced in your response in the attachments array, but be sure to only include each key at most once
          4. Make sure your response is a valid JSON object that can be parsed`
        },
        {
          role: "user",
          content: `Here are some relevant document summaries:

${contextString}

Question: ${query}`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    })

    const parsedResponse = JSON.parse(response.choices[0].message.content || '{"response": "Sorry, I couldn\'t generate a response.", "attachments": []}')
    console.log(parsedResponse)
    return {
      answer: parsedResponse.response,
      attachments: parsedResponse.attachments
    }
  }
}
