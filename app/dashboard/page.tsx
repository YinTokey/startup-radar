import { Suspense } from "react"
import { DashboardClient } from "./client"
import { TrendingUp } from "lucide-react"

// Types shared between server and client
export interface Post {
  id: string
  reddit_id: string
  subreddit: string
  title: string
  content: string
  author: string
  upvotes: number
  comments: number
  url: string
  created_at: string
  metadata?: Record<string, unknown>
}

export interface PostAnalytics {
  id: string
  post_id: string
  sentiment_score: number
  relevance_score: number
  innovation_score: number
  market_viability: number
  trending_score: number
  ai_summary: string
  tags: string[]
  prompt_id: string
  prompt_version: string
  analyzed_at: string
}

export interface PostWithAnalytics extends Post {
  post_analytics?: PostAnalytics[]
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ApiResponse {
  data: PostWithAnalytics[]
  pagination: Pagination
  error?: string
}

// Configure ISR - revalidate every 60 seconds
export const revalidate = 60

// Server function to fetch initial data
async function getInitialData(): Promise<ApiResponse> {
  try {
    // Use the internal API URL for server-side fetching
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com'
      : 'http://localhost:3000'
    
    const res = await fetch(`${baseUrl}/api/posts?subreddit=all&sortBy=trending_score&page=1`, {
      next: { 
        revalidate: 60, // ISR - revalidate every 60 seconds
        tags: ['posts', 'analytics'] // Tag for on-demand revalidation
      }
    })
    
    if (!res.ok) {
      throw new Error(`API returned ${res.status}`)
    }

    const data = await res.json()
    return data
  } catch (error) {
    console.error("Error fetching initial data:", error)
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      },
      error: "Failed to fetch initial data"
    }
  }
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <TrendingUp className="h-12 w-12 text-blue-600 animate-pulse mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Loading startup insights...</p>
      </div>
    </div>
  )
}

export default async function Dashboard() {
  // Fetch initial data with ISR
  const initialData = await getInitialData()

  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardClient initialData={initialData} />
    </Suspense>
  )
}
