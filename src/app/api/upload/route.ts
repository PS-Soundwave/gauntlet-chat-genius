import { s3Client } from '@/lib/s3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { currentUser } from '@clerk/nextjs/server'
import { processPdf } from '@/lib/pdf'
import { db } from '@/db'
import { files } from '@/db/schema'

export async function POST(req: NextRequest) {
  const user = await currentUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const key = `uploads/${nanoid()}-${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }))

    // Store file metadata
    await db.insert(files).values({
      key,
      filename: file.name,
      contentType: file.type,
      size: buffer.length
    })

    // If it's a PDF, process it
    if (file.type === 'application/pdf') {
      try {
        await processPdf(file, key, file.name)
      } catch (error) {
        console.error('PDF processing error:', error)
        // Don't fail the upload if PDF processing fails
      }
    }

    return Response.json({ 
      key
    })
  } catch (error) {
    console.error('Upload error:', error)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
} 