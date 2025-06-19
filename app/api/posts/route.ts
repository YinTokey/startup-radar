import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

// Same mock posts used in the dashboard ― guarantees a valid payload if Supabase isn't configured.
const mockPosts = [
  {
    id: "1",
    subreddit: "saas",
    title: "Built a SaaS for automated customer support - $2k MRR in 3 months",
    content: "After struggling with customer support at my previous startup...",
    author: "techfounder",
    upvotes: 234,
    comments: 45,
    trending_score: 279,
    sentiment_score: 0.8,
    ai_summary:
      "A founder shares their success story of building an automated customer support SaaS that reached $2k MRR in 3 months. The tool uses AI to handle common customer queries and has shown promising growth metrics.",
    relevance_score: 0.95,
    created_at: "2024-01-15T10:30:00Z",
    tags: ["SaaS", "Customer Support", "AI", "Revenue"],
  },
  {
    id: "2",
    subreddit: "sideprojects",
    title: "Weekend project: AI-powered meal planning app",
    content: "Spent the weekend building a meal planning app that uses AI...",
    author: "weekendbuilder",
    upvotes: 156,
    comments: 28,
    trending_score: 184,
    sentiment_score: 0.7,
    ai_summary:
      "Developer showcases a weekend project - an AI-powered meal planning app that generates personalized meal plans based on dietary preferences and available ingredients.",
    relevance_score: 0.85,
    created_at: "2024-01-15T08:15:00Z",
    tags: ["AI", "Mobile App", "Health", "Weekend Project"],
  },
  {
    id: "3",
    subreddit: "startupideas",
    title: "Idea: Platform for remote team building activities",
    content: "With remote work becoming permanent, there's a gap in team building...",
    author: "remoteworker",
    upvotes: 89,
    comments: 67,
    trending_score: 156,
    sentiment_score: 0.6,
    ai_summary:
      "Startup idea for a platform dedicated to remote team building activities. The concept addresses the growing need for virtual team engagement as remote work becomes more prevalent.",
    relevance_score: 0.9,
    created_at: "2024-01-15T06:45:00Z",
    tags: ["Remote Work", "Team Building", "Platform", "B2B"],
  },
]

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const subreddit = searchParams.get("subreddit") ?? "all"
  const sortBy = searchParams.get("sortBy") ?? "trending_score"

  // If env vars are missing, instantly return mock data
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn("Supabase env vars missing – returning mock posts.")
    return NextResponse.json({ data: mockPosts })
  }

  try {
    let query = supabase.from("posts").select("*").order(sortBy, { ascending: false }).limit(50)
    if (subreddit !== "all") query = query.eq("subreddit", subreddit)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error("Supabase query error:", err)
    // Fall back to mock data so the dashboard still works
    return NextResponse.json({ data: mockPosts })
  }
}
