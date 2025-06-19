import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use service role key for server-side real-time subscriptions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export async function GET(request: NextRequest) {
  // Set up SSE headers
  const responseHeaders = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  })

  // Create a readable stream for SSE
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      console.log('SSE: Client connected')
      
      // Send initial connection message
      const connectionMessage = `data: ${JSON.stringify({
        type: 'connection',
        status: 'connected',
        timestamp: new Date().toISOString()
      })}\n\n`
      controller.enqueue(encoder.encode(connectionMessage))

      // Set up Supabase real-time subscription with service role
      const subscription = supabaseAdmin
        .channel('sse-posts-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'posts'
          },
          (payload) => {
            console.log('SSE: Posts INSERT detected:', payload.new?.id)
            
            const message = `data: ${JSON.stringify({
              type: 'posts_change',
              eventType: 'INSERT',
              table: 'posts',
              data: payload.new,
              timestamp: new Date().toISOString()
            })}\n\n`
            
            try {
              controller.enqueue(encoder.encode(message))
            } catch (error) {
              console.error('SSE: Error sending posts message:', error)
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'post_analytics'
          },
          (payload) => {
            console.log('SSE: Post analytics INSERT detected:', payload.new?.id)
            
            const message = `data: ${JSON.stringify({
              type: 'analytics_change',
              eventType: 'INSERT',
              table: 'post_analytics',
              data: payload.new,
              timestamp: new Date().toISOString()
            })}\n\n`
            
            try {
              controller.enqueue(encoder.encode(message))
            } catch (error) {
              console.error('SSE: Error sending analytics message:', error)
            }
          }
        )
        .subscribe((status, err) => {
          console.log('SSE: Supabase subscription status:', status)
          
          if (err) {
            console.error('SSE: Supabase subscription error:', err)
            const errorMessage = `data: ${JSON.stringify({
              type: 'error',
              error: err.message,
              timestamp: new Date().toISOString()
            })}\n\n`
            
            try {
              controller.enqueue(encoder.encode(errorMessage))
            } catch (error) {
              console.error('SSE: Error sending error message:', error)
            }
          }
          
          // Send status update to client
          const statusMessage = `data: ${JSON.stringify({
            type: 'subscription_status',
            status: status,
            timestamp: new Date().toISOString()
          })}\n\n`
          
          try {
            controller.enqueue(encoder.encode(statusMessage))
          } catch (error) {
            console.error('SSE: Error sending status message:', error)
          }
        })

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log('SSE: Client disconnected')
        supabaseAdmin.removeChannel(subscription)
        controller.close()
      })

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        const pingMessage = `data: ${JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString()
        })}\n\n`
        
        try {
          controller.enqueue(encoder.encode(pingMessage))
        } catch (error) {
          console.error('SSE: Error sending ping:', error)
          clearInterval(keepAlive)
          supabaseAdmin.removeChannel(subscription)
          controller.close()
        }
      }, 30000)

      // Cleanup on stream close
      const cleanup = () => {
        clearInterval(keepAlive)
        supabaseAdmin.removeChannel(subscription)
        console.log('SSE: Cleanup completed')
      }

      // Handle various close scenarios
      request.signal.addEventListener('abort', cleanup)
    }
  })

  return new Response(stream, {
    headers: responseHeaders,
  })
} 