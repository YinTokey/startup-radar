import { CONFIG } from './config.js'

// Reddit API functions
export async function getRedditAccessToken() {
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

export async function fetchSubredditPosts(subreddit, accessToken, limit = 25) {
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