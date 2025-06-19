import { config } from 'dotenv'

// Load environment variables from .env file (for local development)
config()

// Validate required environment variables
export function validateEnvironment() {
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

// Configuration object
export const CONFIG = {
  subreddits: (process.env.SUBREDDITS || 'saas,startups,sideprojects').split(','),
  postLimit: parseInt(process.env.POST_LIMIT || '5'),
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

// Configure LangSmith if enabled
if (process.env.LANGCHAIN_TRACING_V2 === 'true') {
  process.env.LANGCHAIN_TRACING_V2 = 'true'
  process.env.LANGCHAIN_ENDPOINT = process.env.LANGCHAIN_ENDPOINT || 'https://api.smith.langchain.com'
  process.env.LANGCHAIN_PROJECT = process.env.LANGCHAIN_PROJECT || 'reddit-startup-monitor'
}

console.log('✅ LangSmith client loaded successfully') 