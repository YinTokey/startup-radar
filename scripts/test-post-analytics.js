import { getPostAnalyticsFlat, getPostsWithAnalytics } from './lib/database.js'

async function testPostAnalytics() {
  console.log('🧪 Testing Post-Based Analytics Structure\n')
  
  try {
    // Test 1: Get flattened post analytics
    console.log('📊 Test 1: Flattened Post Analytics')
    const { data: flatAnalytics, error: flatError } = await getPostAnalyticsFlat({ limit: 5 })
    
    if (flatError) {
      console.error('❌ Error:', flatError)
    } else {
      console.log(`✅ Found ${flatAnalytics.length} posts`)
      
      if (flatAnalytics.length > 0) {
        const samplePost = flatAnalytics[0]
        console.log('\n📝 Sample Post Structure:')
        console.log('Post ID:', samplePost.post_id)
        console.log('Title:', samplePost.title?.substring(0, 50) + '...')
        console.log('Subreddit:', samplePost.subreddit)
        console.log('Sentiment Score:', samplePost.sentiment_score)
        console.log('Relevance Score:', samplePost.relevance_score)
        console.log('Innovation Score:', samplePost.innovation_score)
        console.log('Has Analytics:', samplePost.has_analytics)
        console.log('Total Engagement:', samplePost.total_engagement)
      }
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // Test 2: Get nested post analytics
    console.log('📊 Test 2: Nested Post Analytics')
    const { data: nestedAnalytics, error: nestedError } = await getPostsWithAnalytics({ limit: 3 })
    
    if (nestedError) {
      console.error('❌ Error:', nestedError)
    } else {
      console.log(`✅ Found ${nestedAnalytics.length} posts with nested analytics`)
      
      nestedAnalytics.forEach((post, index) => {
        console.log(`\n📋 Post ${index + 1}:`)
        console.log('Title:', post.title?.substring(0, 40) + '...')
        console.log('Subreddit:', post.subreddit)
        console.log('Analytics Count:', post.post_analytics?.length || 0)
        
        if (post.post_analytics && post.post_analytics.length > 0) {
          const analytics = post.post_analytics[0]
          console.log('  - Sentiment:', analytics.sentiment_score)
          console.log('  - Relevance:', analytics.relevance_score)
          console.log('  - Innovation:', analytics.innovation_score)
          console.log('  - Prompt Version:', analytics.prompt_version)
        }
      })
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // Test 3: Verify individual post analytics
    console.log('📊 Test 3: Post Analytics Summary')
    
    if (flatAnalytics && flatAnalytics.length > 0) {
      const withAnalytics = flatAnalytics.filter(p => p.has_analytics)
      const avgSentiment = withAnalytics.reduce((sum, p) => sum + (p.sentiment_score || 0), 0) / withAnalytics.length
      const avgRelevance = withAnalytics.reduce((sum, p) => sum + (p.relevance_score || 0), 0) / withAnalytics.length
      const avgInnovation = withAnalytics.reduce((sum, p) => sum + (p.innovation_score || 0), 0) / withAnalytics.length
      
      console.log('📈 Analytics Summary:')
      console.log(`Total Posts: ${flatAnalytics.length}`)
      console.log(`Posts with Analytics: ${withAnalytics.length}`)
      console.log(`Coverage: ${((withAnalytics.length / flatAnalytics.length) * 100).toFixed(1)}%`)
      console.log(`Average Sentiment: ${avgSentiment.toFixed(3)}`)
      console.log(`Average Relevance: ${avgRelevance.toFixed(3)}`)
      console.log(`Average Innovation: ${avgInnovation.toFixed(3)}`)
      
      // Breakdown by subreddit
      const subredditBreakdown = flatAnalytics.reduce((acc, post) => {
        const sub = post.subreddit || 'unknown'
        if (!acc[sub]) acc[sub] = { total: 0, analyzed: 0 }
        acc[sub].total++
        if (post.has_analytics) acc[sub].analyzed++
        return acc
      }, {})
      
      console.log('\n📊 Subreddit Breakdown:')
      Object.entries(subredditBreakdown).forEach(([subreddit, stats]) => {
        console.log(`  ${subreddit}: ${stats.analyzed}/${stats.total} posts analyzed`)
      })
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testPostAnalytics()
  .then(() => {
    console.log('\n✅ Post analytics test completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }) 