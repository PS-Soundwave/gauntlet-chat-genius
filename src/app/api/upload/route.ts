import { createPresignedUploadUrl } from '@/lib/s3'
import { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { currentUser } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  const user = await currentUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { filename, contentType } = await req.json()
  
  const key = `uploads/${nanoid()}-${filename}`
  const { url, fields } = await createPresignedUploadUrl(key, contentType)

  return Response.json({ url, fields, key })
} 