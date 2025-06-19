#!/usr/bin/env node

// Import all the modules
import { validateEnvironment, CONFIG } from './lib/config.js'
import { log } from './lib/logger.js'
import { getRedditAccessToken, fetchSubredditPosts } from './lib/reddit-api.js'
import { analyzePost } from './lib/ai-analyzer.js'
import { savePostToDatabase } from './lib/database.js'
import { langsmithAdmin } from '../lib/langsmith-admin.js'

// Main execution function - Clean workflow
async function main() {
  const startTime = Date.now()
  
  // Validate environment variables first
  validateEnvironment()
  
  await log('info', 'Starting Reddit scraper job', { 
    subreddits: CONFIG.subreddits, 
    postLimit: CONFIG.postLimit 
  })
  
  // Validate LangSmith prompt availability
  await validateLangSmithSetup()
  
  let totalProcessed = 0
  let totalSaved = 0
  let totalSkipped = 0
  let totalErrors = 0
  
  try {
    // STEP 1: FETCH REDDIT DATA
    const allPosts = await fetchRedditData()
    
    // STEP 2: AI ANALYZE AND EXTRACT
    const analyzedPosts = await analyzeRedditPosts(allPosts)
    totalProcessed = allPosts.length
    
    // STEP 3: UPDATE SUPABASE
    const results = await saveToDatabase(analyzedPosts)
    totalSaved = results.saved
    totalSkipped = results.skipped
    totalErrors = results.errors
    
  } catch (error) {
    await log('error', '❌ Job failed', { error: error.message })
    process.exit(1)
  }
  
  // Summary and completion
  await logJobSummary(startTime, totalProcessed, totalSaved, totalSkipped, totalErrors)
  
  // Exit with error code if there were significant failures
  if (totalErrors > totalProcessed * 0.5) {
    await log('error', '❌ Too many errors, marking job as failed')
    process.exit(1)
  }
}

// STEP 1: Fetch Reddit Data
async function fetchRedditData() {
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
  return allPosts
}

// STEP 2: AI Analysis
async function analyzeRedditPosts(allPosts) {
  await log('info', '🤖 STEP 2: AI analysis and data extraction')
  const analyzedPosts = []
  
  for (const [index, post] of allPosts.entries()) {
    const postNumber = index + 1
    
    try {
      await log('info', `Analyzing post ${postNumber}/${allPosts.length}: ${post.title.substring(0, 50)}...`)
      
      // AI analysis
      const analysis = await analyzePost(post)
      
      // Separate post data from analytics data
      const postData = {
        // Core Reddit post data
        reddit_id: post.id,
        subreddit: post.source_subreddit,
        title: post.title,
        content: post.selftext || '',
        author: post.author,
        upvotes: post.ups || 0,
        comments: post.num_comments || 0,
        url: `https://reddit.com${post.permalink}`,
        metadata: {
          reddit_created_utc: post.created_utc,
          reddit_score: post.score,
          reddit_upvote_ratio: post.upvote_ratio,
        }
      }
      
      const analyticsData = {
        // AI analysis results
        sentiment_score: analysis.sentiment_score,
        relevance_score: analysis.relevance_score,
        innovation_score: analysis.innovation_score,
        market_viability: analysis.market_viability,
        trending_score: (post.ups || 0) + (post.num_comments || 0) * 2,
        ai_summary: analysis.summary,
        tags: analysis.tags || [],
        prompt_id: analysis.prompt_id || 'fallback',
        prompt_version: analysis.prompt_version || 'fallback',
      }
      
      analyzedPosts.push({ postData, analyticsData })
      await log('info', `✅ Analysis complete for post ${postNumber}`)
      
      // Rate limiting between AI requests
      await new Promise(resolve => setTimeout(resolve, 1000))
      
    } catch (error) {
      await log('error', `❌ Failed to analyze post ${postNumber}`, { 
        postId: post.id, 
        error: error.message 
      })
    }
  }
  
  await log('info', `🧠 AI analysis complete: ${analyzedPosts.length} posts analyzed`)
  return analyzedPosts
}

// STEP 3: Save to Database
async function saveToDatabase(analyzedPosts) {
  await log('info', '💾 STEP 3: Updating Supabase database')
  
  let saved = 0
  let skipped = 0
  let errors = 0
  
  for (const { postData, analyticsData } of analyzedPosts) {
    try {
      const result = await savePostToDatabase(postData, analyticsData)
      
      if (result.saved) {
        saved++
        await log('info', `✅ Saved post: ${postData.title.substring(0, 50)}...`)
        if (result.warning) {
          await log('warn', result.warning)
        }
      } else if (result.skipped) {
        skipped++
        await log('info', `⏭️ Skipped existing post: ${postData.title.substring(0, 50)}...`)
      } else if (result.error) {
        errors++
        await log('error', `❌ Failed to save post: ${postData.title.substring(0, 50)}...`, {
          error: result.error
        })
      }
      
    } catch (error) {
      errors++
      await log('error', `❌ Database error for post: ${postData.title.substring(0, 50)}...`, {
        error: error.message
      })
    }
  }
  
  await log('info', `💾 Database update complete`)
  return { saved, skipped, errors }
}

// Utility: Validate LangSmith Setup
async function validateLangSmithSetup() {
  try {
    if (!langsmithAdmin) {
      await log('warn', 'LangSmith admin not available - will use fallback prompt')
    } else {
      const prompts = await langsmithAdmin.getPrompts()
      await log('info', `Found ${prompts.length} prompts in LangSmith`)
      
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
}

// Utility: Log Job Summary
async function logJobSummary(startTime, totalProcessed, totalSaved, totalSkipped, totalErrors) {
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
}

// Execute main function
main().catch(async (error) => {
  await log('error', 'Unhandled error', { error: error.message, stack: error.stack })
  process.exit(1)
}) 