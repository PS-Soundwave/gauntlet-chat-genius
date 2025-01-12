import { NextRequest } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getAuth } from '@clerk/nextjs/server'
import { s3Client } from '@/lib/s3'

export async function GET(req: NextRequest) {
  const { userId } = getAuth(req)
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  const filename = url.searchParams.get('filename')
  
  if (!key || !filename) {
    return new Response('Missing key or filename', { status: 400 })
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key
    })

    const response = await s3Client.send(command)
    
    if (!response.Body) {
      throw new Error('No response body')
    }

    // Convert to Web Stream
    const stream = response.Body.transformToWebStream()

    // Set appropriate headers for the download
    const headers = new Headers()
    headers.set('Content-Type', response.ContentType || 'application/octet-stream')
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    if (response.ContentLength) {
      headers.set('Content-Length', response.ContentLength.toString())
    }

    return new Response(stream, { headers })
  } catch (error) {
    console.error('Error downloading file:', error)
    return new Response('Error downloading file', { status: 500 })
  }
} 