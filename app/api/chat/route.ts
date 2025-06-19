import { NextRequest, NextResponse } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { PromptTemplate } from "@langchain/core/prompts"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { supabase } from "@/lib/supabase"

// Initialize LangChain
const chatModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
})

const chatPromptTemplate = PromptTemplate.fromTemplate(`
You are a helpful AI assistant for StartupRadar, a platform that analyzes startup trends from Reddit.

You help users understand:
- Startup trends and insights
- Market analysis and opportunities  
- Innovation patterns
- Investment and funding trends
- Entrepreneurship advice

Be conversational, helpful, and focus on startup-related topics. Keep responses concise but informative.

User question: {question}

Assistant response:`)

const parser = new StringOutputParser()
const chatChain = chatPromptTemplate.pipe(chatModel).pipe(parser)

function getClientIP(request: NextRequest): string {
  // Try different headers for getting client IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  if (realIP) {
    return realIP
  }
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  // Fallback to a default if no IP found
  return '127.0.0.1'
}

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json()
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    const userIP = getClientIP(request)
    const startTime = Date.now()
    
    // Generate AI response using LangChain
    const response = await chatChain.invoke({
      question: message
    })
    
    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Store both user message and AI response in database
    const chatSessionId = sessionId || crypto.randomUUID()
    
    // Store user message
    const { error: userMessageError } = await supabase
      .from('chat')
      .insert({
        user_ip: userIP,
        session_id: chatSessionId,
        message: message,
        response: '', // Empty for user messages
        role: 'user',
        is_user_message: true,
        metadata: {
          timestamp: new Date().toISOString()
        }
      })

    if (userMessageError) {
      console.error('Error storing user message:', userMessageError)
    }

    // Store AI response
    const { error: aiResponseError } = await supabase
      .from('chat')
      .insert({
        user_ip: userIP,
        session_id: chatSessionId,
        message: '', // Empty for AI responses
        response: response,
        role: 'assistant',
        is_user_message: false,
        response_time_ms: responseTime,
        metadata: {
          model: "gpt-4o-mini",
          timestamp: new Date().toISOString()
        }
      })

    if (aiResponseError) {
      console.error('Error storing AI response:', aiResponseError)
    }

    return NextResponse.json({
      response,
      sessionId: chatSessionId,
      responseTime
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve chat history for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const userIP = getClientIP(request)

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      )
    }

    const { data: chatHistory, error } = await supabase
      .from('chat')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_ip', userIP)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching chat history:', error)
      return NextResponse.json(
        { error: "Failed to fetch chat history" },
        { status: 500 }
      )
    }

    // Format chat history for frontend
    const formattedHistory = chatHistory.map(msg => ({
      id: msg.id,
      content: msg.is_user_message ? msg.message : msg.response,
      role: msg.role,
      timestamp: msg.created_at,
      responseTime: msg.response_time_ms
    }))

    return NextResponse.json({
      chatHistory: formattedHistory,
      sessionId
    })

  } catch (error) {
    console.error('Chat history API error:', error)
    return NextResponse.json(
      { error: "Failed to fetch chat history" },
      { status: 500 }
    )
  }
} 