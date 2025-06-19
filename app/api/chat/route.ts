import { NextRequest, NextResponse } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { PromptTemplate } from "@langchain/core/prompts"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { supabase } from "@/lib/supabase"
import { langsmithAdmin } from "@/lib/langsmith-admin"

// Initialize LangChain
const chatModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
})

// Fallback prompt template if LangSmith fails
const fallbackChatPrompt = PromptTemplate.fromTemplate(`
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

// Function to get chat prompt from LangSmith
async function getChatPrompt() {
  try {
    console.log('Fetching chat-assistant prompt from LangSmith...')
    
    if (langsmithAdmin) {
      const chatPrompt = await langsmithAdmin.getPromptByName('chat-assistant')
      
      if (chatPrompt) {
        console.log('Successfully loaded chat-assistant prompt from LangSmith', {
          promptId: chatPrompt.id,
          version: chatPrompt.metadata?.version,
          isLangChainPrompt: (chatPrompt.metadata as any)?.is_langchain_prompt
        })
        
        // Check if this is a LangChain prompt object or a template string
        if ((chatPrompt.metadata as any)?.is_langchain_prompt && (chatPrompt as any).langchain_prompt) {
          console.log('Using LangChain Hub prompt directly for chat')
          return (chatPrompt as any).langchain_prompt
        } else if (typeof chatPrompt.prompt === 'string') {
          console.log('Using LangSmith template string for chat')
          return PromptTemplate.fromTemplate(chatPrompt.prompt)
        } else {
          console.log('Invalid prompt format, using fallback')
          return fallbackChatPrompt
        }
      } else {
        console.log('No chat-assistant prompt found, using fallback')
        return fallbackChatPrompt
      }
    } else {
      console.log('LangSmith admin not available, using fallback prompt')
      return fallbackChatPrompt
    }
  } catch (error) {
    console.error('Error fetching chat prompt from LangSmith:', error)
    return fallbackChatPrompt
  }
}

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
    
    console.log('Chat request:', { userIP, sessionId, messageLength: message.length })
    
    // Get the chat prompt from LangSmith
    const chatPromptTemplate = await getChatPrompt()
    
    // Create the chat chain
    const chatChain = chatPromptTemplate.pipe(chatModel).pipe(parser)
    
    // Generate AI response using LangChain
    let chainInput
    
    // Handle different input variable formats
    if (chatPromptTemplate.inputVariables) {
      const inputVars = chatPromptTemplate.inputVariables
      console.log('Chat prompt input variables:', inputVars)
      
      // Map message to the appropriate input variable
      if (inputVars.includes('question')) {
        chainInput = { question: message }
      } else if (inputVars.includes('message')) {
        chainInput = { message: message }
      } else if (inputVars.includes('user_input')) {
        chainInput = { user_input: message }
      } else if (inputVars.includes('input')) {
        chainInput = { input: message }
      } else {
        // Use the first input variable
        chainInput = { [inputVars[0]]: message }
      }
    } else {
      // Fallback to question for template prompts
      chainInput = { question: message }
    }
    
    console.log('Chat chain input:', Object.keys(chainInput))
    
    const response = await chatChain.invoke(chainInput)
    
    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Store both user message and AI response in database
    const chatSessionId = sessionId || crypto.randomUUID()
    
    console.log('Storing messages for session:', chatSessionId)
    
    // Store user message
    const userMessageData = {
      user_ip: userIP,
      session_id: chatSessionId,
      message: message,
      response: '', // Empty for user messages
      role: 'user' as const,
      is_user_message: true,
      metadata: {
        timestamp: new Date().toISOString()
      }
    }
    
    console.log('User message data:', JSON.stringify(userMessageData, null, 2))
    
    const { data: userData, error: userMessageError } = await supabase
      .from('chat')
      .insert(userMessageData)
      .select()

    if (userMessageError) {
      console.error('Error storing user message:', {
        error: userMessageError,
        message: userMessageError.message,
        details: userMessageError.details,
        hint: userMessageError.hint,
        code: userMessageError.code
      })
    } else {
      console.log('User message stored successfully:', userData)
    }

    // Store AI response
    const aiResponseData = {
      user_ip: userIP,
      session_id: chatSessionId,
      message: '', // Empty for AI responses
      response: response,
      role: 'assistant' as const,
      is_user_message: false,
      response_time_ms: responseTime,
      metadata: {
        model: "gpt-4o-mini",
        prompt_source: "langsmith",
        prompt_name: "chat-assistant",
        timestamp: new Date().toISOString()
      }
    }
    
    console.log('AI response data:', JSON.stringify(aiResponseData, null, 2))

    const { data: aiData, error: aiResponseError } = await supabase
      .from('chat')
      .insert(aiResponseData)
      .select()

    if (aiResponseError) {
      console.error('Error storing AI response:', {
        error: aiResponseError,
        message: aiResponseError.message,
        details: aiResponseError.details,
        hint: aiResponseError.hint,
        code: aiResponseError.code
      })
    } else {
      console.log('AI response stored successfully:', aiData)
    }

    return NextResponse.json({
      response,
      sessionId: chatSessionId,
      responseTime
    })

  } catch (error) {
    console.error('Chat API error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
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