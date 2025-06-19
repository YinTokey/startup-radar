#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { promises as fs } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

// Load environment variables from .env file (for local development)
config()

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
  subreddits: (process.env.SUBREDDITS || 'saas,sideprojects,startup,startupideas').split(','),
  postLimit: parseInt(process.env.POST_LIMIT || '25'),
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
  },
  
  // AI Analysis prompt
  analysisPrompt: `Analyze this Reddit post from a startup/business perspective and return a JSON response with the following structure:
{
  "summary": "Brief 1-2 sentence summary of the post",
  "sentiment_score": 0.8,
  "relevance_score": 0.9,
  "innovation_score": 0.7,
  "market_viability": 0.6,
  "tags": ["AI", "SaaS", "B2B"]
}

Score criteria (0.0 to 1.0):
- sentiment_score: Overall positivity/excitement in the post
- relevance_score: How relevant this is to startups/business
- innovation_score: How novel/innovative the idea is
- market_viability: Commercial potential assessment

Post content: {content}

Return only valid JSON, no additional text.`
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
    const prompt = CONFIG.analysisPrompt.replace('{content}', content)
    
    const { text, usage } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: prompt,
      maxTokens: 500,
      temperature: 0.3
    })
    
    const endTime = Date.now()
    const latency = endTime - startTime
    
    // Parse AI response
    let analysis
    try {
      analysis = JSON.parse(text)
    } catch {
      await log('warn', 'Failed to parse AI response, using fallback', { 
        postId: post.id, 
        response: text.substring(0, 200) 
      })
      
      analysis = {
        summary: post.title.substring(0, 200),
        sentiment_score: 0.5,
        relevance_score: 0.5,
        innovation_score: 0.5,
        market_viability: 0.5,
        tags: ['General']
      }
    }
    
    // Log API usage for cost tracking
    await logApiUsage({
      endpoint: 'openai-analysis',
      model: 'gpt-4o-mini',
      tokens_used: usage?.totalTokens || 0,
      prompt_tokens: usage?.promptTokens || 0,
      completion_tokens: usage?.completionTokens || 0,
      latency,
      post_id: post.id,
      success: true
    })
    
    return analysis
    
  } catch (error) {
    await log('error', 'AI analysis failed', { postId: post.id, error: error.message })
    
    // Log failed API call
    await logApiUsage({
      endpoint: 'openai-analysis',
      model: 'gpt-4o-mini',
      tokens_used: 0,
      latency: Date.now() - startTime,
      post_id: post.id,
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
    
    // Calculate estimated cost (rough estimates for gpt-4o-mini)
    const inputCostPer1k = 0.000150   // $0.150 per 1K input tokens
    const outputCostPer1k = 0.000600  // $0.600 per 1K output tokens
    
    const estimatedCost = 
      (usageData.prompt_tokens || 0) * inputCostPer1k / 1000 +
      (usageData.completion_tokens || 0) * outputCostPer1k / 1000
    
    const { error } = await supabase.from('api_usage').insert({
      endpoint: usageData.endpoint,
      prompt_id: 'reddit-analysis-v1',
      tokens_used: usageData.tokens_used,
      cost: estimatedCost,
      latency: usageData.latency,
      metadata: {
        model: usageData.model,
        post_id: usageData.post_id,
        prompt_tokens: usageData.prompt_tokens,
        completion_tokens: usageData.completion_tokens,
        success: usageData.success,
        error: usageData.error
      }
    })
    
    if (error) {
      await log('warn', 'Failed to log API usage', { error: error.message })
    }
    
  } catch (error) {
    await log('warn', 'Failed to log API usage', { error: error.message })
  }
}

async function savePost(post, analysis, subreddit) {
  try {
    const supabase = await initializeSupabase()
    
    // Check if post already exists
    const { data: existingPost } = await supabase
      .from('posts')
      .select('id')
      .eq('reddit_id', post.id)
      .single()
    
    if (existingPost) {
      await log('info', 'Post already exists, skipping', { redditId: post.id })
      return { skipped: true }
    }
    
    // Calculate trending score
    const trendingScore = (post.ups || 0) + (post.num_comments || 0) * 2
    
    const postData = {
      reddit_id: post.id,
      subreddit: subreddit,
      title: post.title,
      content: post.selftext || '',
      author: post.author,
      upvotes: post.ups || 0,
      comments: post.num_comments || 0,
      trending_score: trendingScore,
      sentiment_score: analysis.sentiment_score,
      ai_summary: analysis.summary,
      relevance_score: analysis.relevance_score,
      tags: analysis.tags || [],
      url: `https://reddit.com${post.permalink}`,
      metadata: {
        reddit_created_utc: post.created_utc,
        reddit_score: post.score,
        reddit_upvote_ratio: post.upvote_ratio,
        innovation_score: analysis.innovation_score,
        market_viability: analysis.market_viability
      }
    }
    
    const { data, error } = await supabase.from('posts').insert(postData).select().single()
    
    if (error) {
      throw error
    }
    
    await log('info', 'Post saved successfully', { redditId: post.id, dbId: data.id })
    return { saved: true, data }
    
  } catch (error) {
    await log('error', 'Failed to save post', { redditId: post.id, error: error.message })
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
  
  let totalProcessed = 0
  let totalSaved = 0
  let totalSkipped = 0
  let totalErrors = 0
  
  try {
    // Get Reddit access token
    await log('info', 'Authenticating with Reddit API')
    const accessToken = await getRedditAccessToken()
    
    // Process each subreddit
    for (const subreddit of CONFIG.subreddits) {
      await log('info', `Processing r/${subreddit}`)
      
      try {
        // Fetch posts from subreddit
        const posts = await fetchSubredditPosts(subreddit, accessToken, CONFIG.postLimit)
        await log('info', `Fetched ${posts.length} posts from r/${subreddit}`)
        
        // Process each post
        for (const post of posts) {
          totalProcessed++
          
          try {
            // Analyze with AI
            const analysis = await analyzePost(post)
            
            // Save to database
            const result = await savePost(post, analysis, subreddit)
            
            if (result.saved) {
              totalSaved++
            } else if (result.skipped) {
              totalSkipped++
            } else if (result.error) {
              totalErrors++
            }
            
            // Rate limiting - be nice to APIs
            await new Promise(resolve => setTimeout(resolve, 1000))
            
          } catch (error) {
            totalErrors++
            await log('error', 'Failed to process post', { 
              postId: post.id, 
              error: error.message 
            })
          }
        }
        
      } catch (error) {
        await log('error', `Failed to process r/${subreddit}`, { error: error.message })
      }
    }
    
  } catch (error) {
    await log('error', 'Job failed', { error: error.message })
    process.exit(1)
  }
  
  const endTime = Date.now()
  const duration = Math.round((endTime - startTime) / 1000)
  
  await log('info', 'Job completed', {
    duration: `${duration}s`,
    totalProcessed,
    totalSaved,
    totalSkipped,
    totalErrors
  })
  
  // Exit with error code if there were significant failures
  if (totalErrors > totalProcessed * 0.5) {
    await log('error', 'Too many errors, marking job as failed')
    process.exit(1)
  }
}

// Execute main function
main().catch(async (error) => {
  await log('error', 'Unhandled error', { error: error.message, stack: error.stack })
  process.exit(1)
}) 