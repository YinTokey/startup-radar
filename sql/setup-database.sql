-- Simple database setup without RLS
-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reddit_id TEXT NOT NULL UNIQUE CHECK (reddit_id != ''),
  subreddit TEXT NOT NULL CHECK (subreddit != ''),
  title TEXT NOT NULL CHECK (title != ''),
  content TEXT DEFAULT '',
  author TEXT NOT NULL CHECK (author != ''),
  upvotes INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
  comments INTEGER NOT NULL DEFAULT 0 CHECK (comments >= 0),
  url TEXT NOT NULL CHECK (url != ''),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post analytics table
CREATE TABLE IF NOT EXISTS post_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  sentiment_score DECIMAL(3,2) NOT NULL CHECK (sentiment_score >= 0 AND sentiment_score <= 1),
  relevance_score DECIMAL(3,2) NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
  innovation_score DECIMAL(3,2) NOT NULL CHECK (innovation_score >= 0 AND innovation_score <= 1),
  market_viability DECIMAL(3,2) NOT NULL CHECK (market_viability >= 0 AND market_viability <= 1),
  trending_score INTEGER NOT NULL DEFAULT 0 CHECK (trending_score >= 0),
  ai_summary TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  prompt_id TEXT NOT NULL DEFAULT 'fallback',
  prompt_version TEXT NOT NULL DEFAULT 'fallback',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_reddit_id ON posts(reddit_id);
CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_sentiment ON post_analytics(sentiment_score DESC); 