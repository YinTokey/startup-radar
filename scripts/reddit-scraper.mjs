#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { JsonOutputParser } from '@langchain/core/output_parsers'
import { promises as fs } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'
import { langsmithAdmin } from '../lib/langsmith-admin.js'

// Load environment variables from .env file (for local development)
config()

// Configure LangSmith if enabled
if (process.env.LANGCHAIN_TRACING_V2 === 'true') {
  process.env.LANGCHAIN_TRACING_V2 = 'true'
  process.env.LANGCHAIN_ENDPOINT = process.env.LANGCHAIN_ENDPOINT || 'https://api.smith.langchain.com'
  process.env.LANGCHAIN_PROJECT = process.env.LANGCHAIN_PROJECT || 'reddit-startup-monitor'
}

console.log('✅ LangSmith client loaded successfully')

// Validate required environment variables
function validateEnvironment() {
  const required = [
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'REDDIT_CLIENT_ID',
    'REDDIT_CLIENT_SECRET'
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(key => console.error(`   ${key}`))
    console.error('\nPlease create a .env file with the required variables.')
    console.error('See env.example for reference.')
    process.exit(1)
  }
  
  console.log('✅ Environment variables validated')
}

// Configuration
const CONFIG = {
  subreddits: (process.env.SUBREDDITS || 'saas').split(','),
  postLimit: parseInt(process.env.POST_LIMIT || '1'),
  timeFilter: 'day', // hot posts from last day
  
  // Reddit API credentials
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    userAgent: process.env.REDDIT_USER_AGENT || 'StartupRadar/1.0.0'
  },
  
  // Supabase configuration
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  }
}

// Setup logging
const LOG_DIR = 'logs'
const LOG_FILE = join(LOG_DIR, `reddit-scraper-${new Date().toISOString().slice(0, 10)}.log`)

async function setupLogging() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true })
  } catch (error) {
    console.error('Failed to create logs directory:', error)
  }
}

async function log(level, message, data = null) {
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}${data ? ` ${JSON.stringify(data)}` : ''}\n`
  
  console.log(logEntry.trim())
  
  try {
    await fs.appendFile(LOG_FILE, logEntry)
  } catch (error) {
    console.error('Failed to write to log file:', error)
  }
}

// Reddit API functions
async function getRedditAccessToken() {
  const credentials = Buffer.from(`${CONFIG.reddit.clientId}:${CONFIG.reddit.clientSecret}`).toString('base64')
  
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'User-Agent': CONFIG.reddit.userAgent,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(`Reddit auth failed: ${data.error || response.statusText}`)
  }
  
  return data.access_token
}

async function fetchSubredditPosts(subreddit, accessToken, limit = 25) {
  const url = `https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}&t=${CONFIG.timeFilter}`
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': CONFIG.reddit.userAgent
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch r/${subreddit}: ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.data.children.map(child => child.data)
}

// AI Analysis function
async function analyzePost(post) {
  const startTime = Date.now()
  
  try {
    const content = `Title: ${post.title}\n\nContent: ${post.selftext || 'No content'}`
    
    // Get the active prompt from LangSmith
    let activePrompt = null
    
    if (langsmithAdmin) {
      try {
        const prompts = await langsmithAdmin.getPrompts()
        activePrompt = prompts.find((p) => p.metadata.is_active)
      } catch (error) {
        await log('warn', 'Failed to fetch prompts from LangSmith', { error: error.message })
      }
    }

    let promptTemplate
    if (!activePrompt) {
      await log('warn', 'No active prompt found in LangSmith, using fallback prompt')
      
      // Fallback prompt template
      promptTemplate = PromptTemplate.fromTemplate(`You are a startup analyst. Analyze this Reddit post and return ONLY a JSON object with the exact structure shown below. Do not include any explanatory text, greeting, or additional commentary.

REQUIRED JSON FORMAT:
{{
  "summary": "Brief 1-2 sentence summary of the post",
  "sentiment_score": 0.8,
  "relevance_score": 0.9,
  "innovation_score": 0.7,
  "market_viability": 0.6,
  "tags": ["AI", "SaaS", "B2B"]
}}

SCORING CRITERIA (0.0 to 1.0):
- sentiment_score: Overall positivity/excitement in the post
- relevance_score: How relevant this is to startups/business
- innovation_score: How novel/innovative the idea is
- market_viability: Commercial potential assessment

POST TO ANALYZE:
{content}

RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT:`)
    } else {
      await log('info', 'Using LangSmith prompt', { 
        promptId: activePrompt.id, 
        version: activePrompt.metadata.version 
      })
      
      // Check if this is a LangChain prompt object or a template string
      if (activePrompt.metadata.is_langchain_prompt && activePrompt.langchain_prompt) {
        console.log('Using LangChain Hub prompt directly')
        console.log('Prompt input variables:', activePrompt.langchain_prompt.inputVariables)
        
        // Check if the input variables look correct
        const inputVars = activePrompt.langchain_prompt.inputVariables || []
        const hasValidInputVars = inputVars.some(v => ['content', 'post', 'text'].includes(v)) || 
                                  (inputVars.length === 1 && inputVars[0].length < 50)
        
        if (hasValidInputVars) {
          promptTemplate = activePrompt.langchain_prompt
        } else {
          console.log('LangChain prompt has invalid input variables, falling back to template creation')
          console.log('Invalid variables:', inputVars)
          // Use the known good prompt template instead
          const knownPrompt = `Analyze this Reddit post from a startup/business perspective and return a JSON response with the following structure:

{
  "summary": "Brief 1-2 sentence summary of the post",
  "sentiment_score": 0.8,
  "relevance_score": 0.9,
  "innovation_score": 0.7,
  "market_viability": 0.6,
  "tags": ["AI", "SaaS", "B2B", "B2C"]
}

Score criteria (0 to 1.0):
- sentiment_score: Overall positivity/excitement in the post
- relevance_score: How relevant this is to startups/business
- innovation_score: How novel/innovative the idea is
- market_viability: Commercial potential assessment

Post content: {content}

Return only valid JSON, no additional text.`
          
          promptTemplate = PromptTemplate.fromTemplate(knownPrompt)
        }
      } else {
        // Create LangChain prompt template from string
        console.log('LangSmith prompt content:', activePrompt.prompt.substring(0, 300) + '...')
        console.log('LangSmith prompt input variables expected:', activePrompt.prompt.match(/\{([^}]+)\}/g))
        promptTemplate = PromptTemplate.fromTemplate(activePrompt.prompt)
      }
    }

    // Initialize OpenAI model with LangSmith tracking
    const model = new ChatOpenAI({
      modelName: 'gpt-4.1-nano',
      temperature: 0.1,
      maxTokens: 500,
      metadata: {
        post_id: post.id,
        subreddit: post.subreddit || 'unknown',
        operation: 'reddit-post-analysis',
        prompt_id: activePrompt?.id || 'fallback',
        prompt_version: activePrompt?.metadata?.version || 'fallback'
      },
      tags: ['reddit-analysis', 'startup-monitoring', activePrompt ? `prompt-${activePrompt.metadata.version}` : 'fallback-prompt']
    })

    // Create output parser with format instructions
    const parser = new JsonOutputParser()

    // Create the chain
    const chain = promptTemplate.pipe(model).pipe(parser)

    // Execute the chain with LangSmith tracing
    console.log('Invoking chain with content length:', content.length)
    console.log('Content preview:', content.substring(0, 100) + '...')
    
    // Prepare input based on whether it's a LangChain prompt or template
    let chainInput
    if (activePrompt?.metadata?.is_langchain_prompt && promptTemplate === activePrompt.langchain_prompt) {
      // For valid LangChain Hub prompts, use the expected input variables
      const inputVars = activePrompt.langchain_prompt.inputVariables || ['content']
      console.log('Using LangChain Hub input variables:', inputVars)
      
      // Map our content to the first input variable (or try common ones)
      if (inputVars.includes('content')) {
        chainInput = { content: content }
      } else if (inputVars.includes('post')) {
        chainInput = { post: content }
      } else if (inputVars.includes('text')) {
        chainInput = { text: content }
      } else {
        // Use the first input variable
        chainInput = { [inputVars[0]]: content }
      }
      console.log('Chain input keys:', Object.keys(chainInput))
    } else {
      // For template prompts (including fallback), use our standard format
      chainInput = { content: content }
      console.log('Using standard template input: content')
    }
    
    let analysis
    try {
      analysis = await chain.invoke(chainInput)
    } catch (parseError) {
      await log('warn', 'JSON parsing failed, trying raw response', { error: parseError.message })
      
      // Try without parser to see raw response
      const rawChain = promptTemplate.pipe(model)
      const rawResponse = await rawChain.invoke(chainInput)
      
      await log('debug', 'Raw AI response', { response: rawResponse.content })
      
      // Try to extract JSON from the response
      const jsonMatch = rawResponse.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0])
        } catch (jsonError) {
          throw new Error(`Failed to parse extracted JSON: ${jsonError.message}`)
        }
      } else {
        throw new Error(`No JSON found in response: ${rawResponse.content}`)
      }
    }
    
    // Validate the analysis structure
    if (!analysis || typeof analysis !== 'object') {
      throw new Error('Invalid analysis response from AI')
    }
    
    // Ensure required fields exist with defaults
    const validatedAnalysis = {
      summary: analysis.summary || post.title.substring(0, 200),
      sentiment_score: typeof analysis.sentiment_score === 'number' ? analysis.sentiment_score : 0.5,
      relevance_score: typeof analysis.relevance_score === 'number' ? analysis.relevance_score : 0.5,
      innovation_score: typeof analysis.innovation_score === 'number' ? analysis.innovation_score : 0.5,
      market_viability: typeof analysis.market_viability === 'number' ? analysis.market_viability : 0.5,
      tags: Array.isArray(analysis.tags) ? analysis.tags : ['General']
    }
    
    const endTime = Date.now()
    const latency = endTime - startTime

    // Log API usage for cost tracking (estimate tokens)
    const estimatedTokens = Math.ceil((content.length + 500) / 4) // rough estimate
    await logApiUsage({
      endpoint: 'langchain-openai-analysis',
      model: 'gpt-4.1-nano',
      tokens_used: estimatedTokens,
      prompt_tokens: Math.ceil(content.length / 4),
      completion_tokens: Math.ceil(JSON.stringify(validatedAnalysis).length / 4),
      latency,
      post_id: post.id,
      prompt_id: activePrompt?.id || 'fallback',
      prompt_version: activePrompt?.metadata?.version || 'fallback',
      success: true
    })

    return validatedAnalysis
    
  } catch (error) {
    await log('error', 'AI analysis failed', { postId: post.id, error: error.message })
    
    // Log failed API call
    await logApiUsage({
      endpoint: 'langchain-openai-analysis',
      model: 'gpt-4.1-nano',
      tokens_used: 0,
      latency: Date.now() - startTime,
      post_id: post.id,
      prompt_id: 'error',
      prompt_version: 'error',
      success: false,
      error: error.message
    })
    
    // Return fallback analysis
    return {
      summary: post.title.substring(0, 200),
      sentiment_score: 0.5,
      relevance_score: 0.5,
      innovation_score: 0.5,
      market_viability: 0.5,
      tags: ['Unanalyzed']
    }
  }
}

// Database functions
async function initializeSupabase() {
  const supabase = createClient(
    CONFIG.supabase.url,
    CONFIG.supabase.serviceKey || CONFIG.supabase.anonKey
  )
  
  return supabase
}

async function logApiUsage(usageData) {
  try {
    const supabase = await initializeSupabase()
    
    // Calculate estimated cost (gpt-4.1-nano pricing)
    const inputCostPer1k = 0.000150   // $0.150 per 1K input tokens
    const outputCostPer1k = 0.000600  // $0.600 per 1K output tokens
    
    const estimatedCost = 
      (usageData.prompt_tokens || 0) * inputCostPer1k / 1000 +
      (usageData.completion_tokens || 0) * outputCostPer1k / 1000
    
    const { error } = await supabase.from('api_usage').insert({
      endpoint: usageData.endpoint,
      prompt_id: usageData.prompt_id || 'reddit-analysis-v1',
      tokens_used: usageData.tokens_used,
      cost: estimatedCost,
      latency: usageData.latency,
      metadata: {
        model: usageData.model,
        post_id: usageData.post_id,
        prompt_tokens: usageData.prompt_tokens,
        completion_tokens: usageData.completion_tokens,
        success: usageData.success,
        error: usageData.error,
        langsmith_prompt_id: usageData.prompt_id,
        langsmith_prompt_version: usageData.prompt_version
      }
    })
    
    if (error) {
      await log('warn', 'Failed to log API usage', { error: error.message })
    }
    
  } catch (error) {
    await log('warn', 'Failed to log API usage', { error: error.message })
  }
}

// Database save function for the optimized workflow
async function savePostToDatabase(enrichedPost) {
  try {
    const supabase = await initializeSupabase()
    
    // Check if post already exists
    const { data: existingPost } = await supabase
      .from('posts')
      .select('id')
      .eq('reddit_id', enrichedPost.reddit_id)
      .single()
    
    if (existingPost) {
      return { skipped: true }
    }
    
    const { data, error } = await supabase.from('posts').insert(enrichedPost).select().single()
    
    if (error) {
      throw error
    }
    
    return { saved: true, data }
    
  } catch (error) {
    return { error: error.message }
  }
}

// Main execution function
async function main() {
  const startTime = Date.now()
  
  // Validate environment variables first
  validateEnvironment()
  
  await setupLogging()
  await log('info', 'Starting Reddit scraper job', { 
    subreddits: CONFIG.subreddits, 
    postLimit: CONFIG.postLimit 
  })
  
  // Validate LangSmith prompt availability
  try {
    if (!langsmithAdmin) {
      await log('warn', 'LangSmith admin not available - will use fallback prompt')
    } else {
      const prompts = await langsmithAdmin.getPrompts()
      await log('info', `Found ${prompts.length} prompts in LangSmith`)
      
      // Debug: Log all prompts and their metadata
      prompts.forEach((prompt, index) => {
        console.log(prompt)
        console.log(`[DEBUG] Prompt ${index + 1}:`, {
            id: prompt.id,
            prompt_name: prompt.prompt_name,
            prompt: prompt.prompt,
            metadata: prompt.metadata,
        })
      })
      
      const activePrompt = prompts.find((p) => p.metadata && p.metadata.is_active === true)
      
      if (activePrompt) {
        await log('info', 'LangSmith prompt loaded successfully', {
          promptId: activePrompt.id,
          promptName: activePrompt.prompt_name,
          version: activePrompt.metadata.version
        })
      } else {
        await log('warn', 'No active prompt found in LangSmith - will use fallback prompt')
        await log('info', 'To fix this, set metadata.is_active = true on your prompt in LangSmith console')
      }
    }
  } catch (error) {
    await log('warn', 'Failed to connect to LangSmith - will use fallback prompt', { 
      error: error.message 
    })
  }
  
  let totalProcessed = 0
  let totalSaved = 0
  let totalSkipped = 0
  let totalErrors = 0
  
  try {
    // STEP 1: FETCH REDDIT DATA
    await log('info', '🔄 STEP 1: Fetching Reddit data')
    const accessToken = await getRedditAccessToken()
    
    const allPosts = []
    for (const subreddit of CONFIG.subreddits) {
      await log('info', `Fetching posts from r/${subreddit}`)
      
      try {
        const posts = await fetchSubredditPosts(subreddit, accessToken, CONFIG.postLimit)
        
        // Add subreddit info to each post for processing
        const postsWithSubreddit = posts.map(post => ({
          ...post,
          source_subreddit: subreddit
        }))
        
        allPosts.push(...postsWithSubreddit)
        await log('info', `✅ Fetched ${posts.length} posts from r/${subreddit}`)
        
        // Rate limiting between subreddit requests
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        await log('error', `❌ Failed to fetch from r/${subreddit}`, { error: error.message })
      }
    }
    
    await log('info', `📊 Total posts fetched: ${allPosts.length}`)
    
    // STEP 2: AI ANALYZE AND EXTRACT
    await log('info', '🤖 STEP 2: AI analysis and data extraction')
    const analyzedPosts = []
    
    for (const post of allPosts) {
      totalProcessed++
      
      try {
        await log('info', `Analyzing post ${totalProcessed}/${allPosts.length}: ${post.title.substring(0, 50)}...`)
        
        // AI analysis
        const analysis = await analyzePost(post)
        
        // Combine Reddit data with AI analysis
        const enrichedPost = {
          // Reddit data
          reddit_id: post.id,
          subreddit: post.source_subreddit,
          title: post.title,
          content: post.selftext || '',
          author: post.author,
          upvotes: post.ups || 0,
          comments: post.num_comments || 0,
          trending_score: (post.ups || 0) + (post.num_comments || 0) * 2,
          url: `https://reddit.com${post.permalink}`,
          
          // AI analysis results
          sentiment_score: analysis.sentiment_score,
          ai_summary: analysis.summary,
          relevance_score: analysis.relevance_score,
          tags: analysis.tags || [],
          
          // Additional metadata
          metadata: {
            reddit_created_utc: post.created_utc,
            reddit_score: post.score,
            reddit_upvote_ratio: post.upvote_ratio,
            innovation_score: analysis.innovation_score,
            market_viability: analysis.market_viability,
            analyzed_at: new Date().toISOString()
          }
        }
        
        analyzedPosts.push(enrichedPost)
        await log('info', `✅ Analysis complete for post ${totalProcessed}`)
        
        // Rate limiting between AI requests
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        totalErrors++
        await log('error', `❌ Failed to analyze post ${totalProcessed}`, { 
          postId: post.id, 
          error: error.message 
        })
      }
    }
    
    await log('info', `🧠 AI analysis complete: ${analyzedPosts.length} posts analyzed`)
    
    // STEP 3: UPDATE SUPABASE
    await log('info', '💾 STEP 3: Updating Supabase database')
    
    for (const enrichedPost of analyzedPosts) {
      try {
        const result = await savePostToDatabase(enrichedPost)
        
        if (result.saved) {
          totalSaved++
          await log('info', `✅ Saved post: ${enrichedPost.title.substring(0, 50)}...`)
        } else if (result.skipped) {
          totalSkipped++
          await log('info', `⏭️ Skipped existing post: ${enrichedPost.title.substring(0, 50)}...`)
        } else if (result.error) {
          totalErrors++
          await log('error', `❌ Failed to save post: ${enrichedPost.title.substring(0, 50)}...`, {
            error: result.error
          })
        }
        
      } catch (error) {
        totalErrors++
        await log('error', `❌ Database error for post: ${enrichedPost.title.substring(0, 50)}...`, {
          error: error.message
        })
      }
    }
    
    await log('info', `💾 Database update complete`)
    
  } catch (error) {
    await log('error', '❌ Job failed', { error: error.message })
    process.exit(1)
  }
  
  const endTime = Date.now()
  const duration = Math.round((endTime - startTime) / 1000)
  
  await log('info', '🎉 Job completed successfully', {
    duration: `${duration}s`,
    totalProcessed,
    totalSaved,
    totalSkipped,
    totalErrors,
    workflow: 'fetch-reddit → ai-analyze → update-supabase'
  })
  
  // Exit with error code if there were significant failures
  if (totalErrors > totalProcessed * 0.5) {
    await log('error', '❌ Too many errors, marking job as failed')
    process.exit(1)
  }
}

// Execute main function
main().catch(async (error) => {
  await log('error', 'Unhandled error', { error: error.message, stack: error.stack })
  process.exit(1)
}) 