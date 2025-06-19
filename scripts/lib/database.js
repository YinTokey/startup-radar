import { createClient } from '@supabase/supabase-js'
import { CONFIG } from './config.js'

// Database functions
export async function initializeSupabase() {
  const supabase = createClient(
    CONFIG.supabase.url,
    CONFIG.supabase.serviceKey || CONFIG.supabase.anonKey
  )
  
  return supabase
}

// Save post and analytics separately with proper relationship
export async function savePostToDatabase(enrichedPost, analysisData) {
  try {
    const supabase = await initializeSupabase()
    
    // Check if post already exists
    const { data: existingPost } = await supabase
      .from('posts')
      .select('id')
      .eq('reddit_id', enrichedPost.reddit_id)
      .single()
    
    if (existingPost) {
      return { skipped: true, reason: 'Post already exists' }
    }
    
    // Step 1: Insert post data
    const { data: savedPost, error: postError } = await supabase
      .from('posts')
      .insert({
        reddit_id: enrichedPost.reddit_id,
        subreddit: enrichedPost.subreddit,
        title: enrichedPost.title,
        content: enrichedPost.content,
        author: enrichedPost.author,
        upvotes: enrichedPost.upvotes,
        comments: enrichedPost.comments,
        url: enrichedPost.url,
        metadata: enrichedPost.metadata
      })
      .select()
      .single()
    
    if (postError) {
      throw new Error(`Failed to save post: ${postError.message}`)
    }
    
    // Step 2: Insert analytics data with post relationship
    const { data: savedAnalytics, error: analyticsError } = await supabase
      .from('post_analytics')
      .insert({
        post_id: savedPost.id, // Foreign key relationship
        sentiment_score: analysisData.sentiment_score,
        relevance_score: analysisData.relevance_score,
        innovation_score: analysisData.innovation_score,
        market_viability: analysisData.market_viability,
        trending_score: analysisData.trending_score,
        ai_summary: analysisData.ai_summary,
        tags: analysisData.tags || [],
        prompt_id: analysisData.prompt_id || 'fallback',
        prompt_version: analysisData.prompt_version || 'fallback',
        analyzed_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (analyticsError) {
      // If analytics save fails, we might want to delete the post or log the error
      console.error(`Failed to save analytics for post ${savedPost.id}:`, analyticsError.message)
      return { 
        saved: true, 
        data: savedPost, 
        warning: `Post saved but analytics failed: ${analyticsError.message}` 
      }
    }
    
    return { 
      saved: true, 
      data: { 
        post: savedPost, 
        analytics: savedAnalytics 
      } 
    }
    
  } catch (error) {
    return { error: error.message }
  }
}

// Get posts with their analytics (JOIN query)
export async function getPostsWithAnalytics(options = {}) {
  try {
    const supabase = await initializeSupabase()
    
    let query = supabase
      .from('posts')
      .select(`
        *,
        post_analytics (
          id,
          sentiment_score,
          relevance_score,
          innovation_score,
          market_viability,
          trending_score,
          ai_summary,
          tags,
          prompt_id,
          prompt_version,
          analyzed_at
        )
      `)
    
    // Add filters if provided
    if (options.subreddit) {
      query = query.eq('subreddit', options.subreddit)
    }
    
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false })
    
    const { data, error } = await query
    
    if (error) {
      throw error
    }
    
    return { data, error: null }
    
  } catch (error) {
    return { data: null, error: error.message }
  }
}

// Get analytics for a specific post
export async function getPostAnalytics(postId) {
  try {
    const supabase = await initializeSupabase()
    
    const { data, error } = await supabase
      .from('post_analytics')
      .select('*')
      .eq('post_id', postId)
      .order('analyzed_at', { ascending: false })
    
    if (error) {
      throw error
    }
    
    return { data, error: null }
    
  } catch (error) {
    return { data: null, error: error.message }
  }
}

// Get flattened post analytics for dashboard viewing
export async function getPostAnalyticsFlat(options = {}) {
  try {
    const supabase = await initializeSupabase()
    
    let query = supabase
      .from('posts')
      .select(`
        id,
        reddit_id,
        title,
        subreddit,
        author,
        upvotes,
        comments,
        url,
        created_at,
        post_analytics (
          sentiment_score,
          relevance_score,
          innovation_score,
          market_viability,
          trending_score,
          ai_summary,
          tags,
          prompt_id,
          prompt_version,
          analyzed_at
        )
      `)
    
    // Add filters if provided
    if (options.subreddit) {
      query = query.eq('subreddit', options.subreddit)
    }
    
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false })
    
    const { data, error } = await query
    
    if (error) {
      throw error
    }
    
    // Flatten the data structure for easier dashboard consumption
    const flattenedData = data?.map(post => {
      const analytics = post.post_analytics?.[0] // Get first analytics record
      return {
        // Post data
        post_id: post.id,
        reddit_id: post.reddit_id,
        title: post.title,
        subreddit: post.subreddit,
        author: post.author,
        upvotes: post.upvotes,
        comments: post.comments,
        url: post.url,
        created_at: post.created_at,
        
        // Analytics data (flattened)
        sentiment_score: analytics?.sentiment_score || null,
        relevance_score: analytics?.relevance_score || null,
        innovation_score: analytics?.innovation_score || null,
        market_viability: analytics?.market_viability || null,
        trending_score: analytics?.trending_score || null,
        ai_summary: analytics?.ai_summary || null,
        tags: analytics?.tags || [],
        prompt_id: analytics?.prompt_id || null,
        prompt_version: analytics?.prompt_version || null,
        analyzed_at: analytics?.analyzed_at || null,
        
        // Computed fields
        has_analytics: !!analytics,
        total_engagement: (post.upvotes || 0) + (post.comments || 0)
      }
    }) || []
    
    return { data: flattenedData, error: null }
    
  } catch (error) {
    return { data: null, error: error.message }
  }
} 