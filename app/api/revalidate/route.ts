import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    const { tags } = await request.json()
    
    // Validate request
    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json({ error: 'Invalid tags parameter' }, { status: 400 })
    }

    // Check for revalidation secret for security
    const secret = request.headers.get('x-revalidate-secret')
    if (secret !== process.env.REVALIDATE_SECRET && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    // Revalidate specified tags
    for (const tag of tags) {
      revalidateTag(tag)
    }

    return NextResponse.json({ 
      revalidated: true, 
      tags,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Revalidation error:', error)
    return NextResponse.json({ error: 'Failed to revalidate' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST method to revalidate',
    example: {
      method: 'POST',
      body: { tags: ['posts', 'analytics'] },
      headers: { 'x-revalidate-secret': 'your-secret' }
    }
  })
} 