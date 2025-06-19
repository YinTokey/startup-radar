# StartupRadar

AI-powered startup intelligence platform that discovers trending startup ideas from Reddit communities.

## 🚀 Live Demo

[View on Vercel](https://startup-radar-blush.vercel.app/)

## 🛠️ Local Development

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup

1. **Install dependencies**
```bash
npm install
```

2. **Environment Variables**
Create a `.env.local` file with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LangSmith
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=your_langsmith_api_key
LANGSMITH_PROJECT=your_project_name

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Reddit API
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=StartupRadar/1.0.0
```

3. **Run the application**
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## ✨ Key Features

- **Multi-Subreddit Monitoring**: Track r/saas, r/sideprojects, r/startup, and r/startupideas
- **AI-Powered Analysis**: Automated sentiment scoring and trend analysis using OpenAI
- **Real-time Dashboard**: Live updates with startup idea insights
- **Reddit Scraping**: Automated data collection from startup communities

## 🔧 Key Technologies

- **LangSmith**: AI usage monitoring, prompt management
- **Supabase**: Real-time data subscriptions for live dashboard updates
- **Next.js ISR**: Incremental Static Regeneration for optimal performance
