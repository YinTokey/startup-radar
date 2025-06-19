-- Insert sample prompts for A/B testing
INSERT INTO prompts (name, template, version, is_active, performance_metrics) VALUES
(
    'Startup Analysis v1',
    'Analyze this Reddit post about a startup or business idea. Provide:
1. A concise summary (2-3 sentences)
2. Relevance score (0-1) for startup/business content
3. Sentiment score (0-1) where 0=negative, 0.5=neutral, 1=positive
4. Key tags (max 5)

Post: {content}

Respond in JSON format:
{
  "summary": "...",
  "relevance_score": 0.0,
  "sentiment_score": 0.0,
  "tags": ["tag1", "tag2"]
}',
    '1.0',
    true,
    '{"avg_relevance": 0.85, "avg_sentiment": 0.72, "usage_count": 0}'
),
(
    'Startup Analysis v2',
    'You are an expert startup analyst. Evaluate this Reddit post:

Content: {content}

Provide analysis in JSON format:
{
  "summary": "Brief, engaging summary highlighting key business aspects",
  "relevance_score": 0.0,
  "sentiment_score": 0.0,
  "innovation_potential": 0.0,
  "market_viability": 0.0,
  "tags": ["relevant", "business", "tags"]
}

Focus on business viability, innovation, and market potential.',
    '2.0',
    true,
    '{"avg_relevance": 0.0, "avg_sentiment": 0.0, "usage_count": 0}'
);

-- Insert sample posts for demo
INSERT INTO posts (reddit_id, subreddit, title, content, author, upvotes, comments, trending_score, sentiment_score, ai_summary, relevance_score, tags, url) VALUES
(
    'demo_1',
    'saas',
    'Built a SaaS for automated customer support - $2k MRR in 3 months',
    'After struggling with customer support at my previous startup, I decided to build an AI-powered solution. The tool automatically handles common queries, escalates complex issues, and provides analytics. Reached $2k MRR in 3 months with 15 paying customers.',
    'techfounder',
    234,
    45,
    279,
    0.8,
    'A founder shares their success story of building an automated customer support SaaS that reached $2k MRR in 3 months. The tool uses AI to handle common customer queries and has shown promising growth metrics.',
    0.95,
    ARRAY['SaaS', 'Customer Support', 'AI', 'Revenue'],
    'https://reddit.com/r/saas/demo_1'
),
(
    'demo_2',
    'sideprojects',
    'Weekend project: AI-powered meal planning app',
    'Spent the weekend building a meal planning app that uses AI to generate personalized meal plans based on dietary preferences, available ingredients, and cooking time. Built with React Native and OpenAI API.',
    'weekendbuilder',
    156,
    28,
    184,
    0.7,
    'Developer showcases a weekend project - an AI-powered meal planning app that generates personalized meal plans based on dietary preferences and available ingredients.',
    0.85,
    ARRAY['AI', 'Mobile App', 'Health', 'Weekend Project'],
    'https://reddit.com/r/sideprojects/demo_2'
),
(
    'demo_3',
    'startupideas',
    'Idea: Platform for remote team building activities',
    'With remote work becoming permanent, there''s a gap in team building solutions. Thinking of building a platform that offers virtual escape rooms, online games, and structured activities for remote teams. Would charge companies monthly per employee.',
    'remoteworker',
    89,
    67,
    156,
    0.6,
    'Startup idea for a platform dedicated to remote team building activities. The concept addresses the growing need for virtual team engagement as remote work becomes more prevalent.',
    0.9,
    ARRAY['Remote Work', 'Team Building', 'Platform', 'B2B'],
    'https://reddit.com/r/startupideas/demo_3'
);
