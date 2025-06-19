import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

// Updated mock data to match new schema
const mockPosts = [
  {
    id: "1",
    reddit_id: "post_1",
    subreddit: "saas",
    title: "Built a SaaS for automated customer support - $2k MRR in 3 months",
    content: "After struggling with customer support at my previous startup...",
    author: "techfounder",
    upvotes: 234,
    comments: 45,
    url: "https://reddit.com/r/saas/post_1",
    created_at: "2024-01-15T10:30:00Z",
    post_analytics: [{
      id: "analytics_1",
      post_id: "1",
      sentiment_score: 0.8,
      relevance_score: 0.95,
      innovation_score: 0.85,
      market_viability: 0.88,
      trending_score: 279,
      ai_summary: "A founder shares their success story of building an automated customer support SaaS that reached $2k MRR in 3 months. The tool uses AI to handle common customer queries and has shown promising growth metrics.",
      tags: ["SaaS", "Customer Support", "AI", "Revenue"],
      prompt_id: "startup-analysis-2",
      prompt_version: "v2.1",
      analyzed_at: "2024-01-15T11:00:00Z"
    }]
  },
  {
    id: "2",
    reddit_id: "post_2",
    subreddit: "sideprojects",
    title: "Weekend project: AI-powered meal planning app",
    content: "Spent the weekend building a meal planning app that uses AI...",
    author: "weekendbuilder",
    upvotes: 156,
    comments: 28,
    url: "https://reddit.com/r/sideprojects/post_2",
    created_at: "2024-01-15T08:15:00Z",
    post_analytics: [{
      id: "analytics_2",
      post_id: "2",
      sentiment_score: 0.7,
      relevance_score: 0.85,
      innovation_score: 0.75,
      market_viability: 0.65,
      trending_score: 184,
      ai_summary: "Developer showcases a weekend project - an AI-powered meal planning app that generates personalized meal plans based on dietary preferences and available ingredients.",
      tags: ["AI", "Mobile App", "Health", "Weekend Project"],
      prompt_id: "startup-analysis-2",
      prompt_version: "v2.1",
      analyzed_at: "2024-01-15T09:00:00Z"
    }]
  },
  {
    id: "3",
    reddit_id: "post_3",
    subreddit: "startupideas",
    title: "Idea: Platform for remote team building activities",
    content: "With remote work becoming permanent, there is a gap in team building...",
    author: "remoteworker",
    upvotes: 89,
    comments: 67,
    url: "https://reddit.com/r/startupideas/post_3",
    created_at: "2024-01-15T06:45:00Z",
    post_analytics: [{
      id: "analytics_3",
      post_id: "3",
      sentiment_score: 0.6,
      relevance_score: 0.9,
      innovation_score: 0.7,
      market_viability: 0.8,
      trending_score: 156,
      ai_summary: "Startup idea for a platform dedicated to remote team building activities. The concept addresses the growing need for virtual team engagement as remote work becomes more prevalent.",
      tags: ["Remote Work", "Team Building", "Platform", "B2B"],
      prompt_id: "startup-analysis-2",
      prompt_version: "v2.1",
      analyzed_at: "2024-01-15T07:30:00Z"
    }]
  },
]

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const subreddit = searchParams.get("subreddit") ?? "all"
  const sortBy = searchParams.get("sortBy") ?? "created_at"

  // If env vars are missing, instantly return mock data
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn("Supabase env vars missing – returning mock posts.")
    return NextResponse.json({ data: mockPosts })
  }

  try {
    // Build query with post_analytics join
    let query = supabase
      .from("posts")
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
      .limit(50)

    // Filter by subreddit if specified
    if (subreddit !== "all") {
      query = query.eq("subreddit", subreddit)
    }

    // Handle sorting - analytics fields need special handling
    const analyticsFields = ["trending_score", "sentiment_score", "relevance_score", "innovation_score", "market_viability"]
    
    if (analyticsFields.includes(sortBy)) {
      // For analytics fields, we'll sort on the frontend since we can't easily sort by joined table fields in this query
      query = query.order("created_at", { ascending: false })
    } else {
      // For post fields, sort normally
      query = query.order(sortBy, { ascending: false })
    }

    const { data, error } = await query
    if (error) throw error

    // Client-side sorting for analytics fields
    let sortedData = data || []
    if (analyticsFields.includes(sortBy)) {
      sortedData.sort((a, b) => {
        const aValue = a.post_analytics?.[0]?.[sortBy] ?? 0
        const bValue = b.post_analytics?.[0]?.[sortBy] ?? 0
        return bValue - aValue // Descending order
      })
    }

    return NextResponse.json({ data: sortedData })
  } catch (err) {
    console.error("Supabase query error:", err)
    // Fall back to mock data so the dashboard still works
    return NextResponse.json({ data: mockPosts })
  }
}
