import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const subreddit = searchParams.get("subreddit") ?? "all"
  const sortBy = searchParams.get("sortBy") ?? "created_at"
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = 10
  const offset = (page - 1) * limit

  // Check if Supabase is configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ 
      data: [], 
      error: "Supabase not configured",
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    })
  }

  try {
    // First, get the total count for pagination
    let countQuery = supabase
      .from("posts")
      .select("*", { count: "exact", head: true })

    if (subreddit !== "all") {
      countQuery = countQuery.eq("subreddit", subreddit)
    }

    const { count, error: countError } = await countQuery
    if (countError) throw countError

    // Build main query with post_analytics join
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
      .range(offset, offset + limit - 1)

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
    const sortedData = data || []
    if (analyticsFields.includes(sortBy)) {
      sortedData.sort((a, b) => {
        const aValue = a.post_analytics?.[0]?.[sortBy] ?? 0
        const bValue = b.post_analytics?.[0]?.[sortBy] ?? 0
        return bValue - aValue // Descending order
      })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({ 
      data: sortedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (err) {
    console.error("Supabase query error:", err)
    return NextResponse.json({ 
      data: [], 
      error: "Failed to fetch posts",
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    })
  }
}
