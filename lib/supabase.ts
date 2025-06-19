import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-anon-key"

// Create a single reusable client instance
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// Keep the createClient function for backward compatibility if needed
export function createClient() {
  return supabase
}

interface PerformanceMetrics {
  accuracy?: number
  precision?: number
  recall?: number
  f1_score?: number
  latency_ms?: number
  cost_per_request?: number
  total_requests?: number
  success_rate?: number
  [key: string]: number | undefined
}

export type Database = {
  public: {
    Tables: {
      posts: {
        Row: {
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
          updated_at: string
          metadata?: {
            reddit_created_utc?: number
            reddit_score?: number
            reddit_upvote_ratio?: number
            [key: string]: unknown
          }
        }
        Insert: {
          id?: string
          reddit_id: string
          subreddit: string
          title: string
          content: string
          author: string
          upvotes: number
          comments: number
          url: string
          created_at?: string
          updated_at?: string
          metadata?: {
            reddit_created_utc?: number
            reddit_score?: number
            reddit_upvote_ratio?: number
            [key: string]: unknown
          }
        }
        Update: {
          id?: string
          reddit_id?: string
          subreddit?: string
          title?: string
          content?: string
          author?: string
          upvotes?: number
          comments?: number
          url?: string
          created_at?: string
          updated_at?: string
          metadata?: {
            reddit_created_utc?: number
            reddit_score?: number
            reddit_upvote_ratio?: number
            [key: string]: unknown
          }
        }
      }
      post_analytics: {
        Row: {
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          sentiment_score: number
          relevance_score: number
          innovation_score: number
          market_viability: number
          trending_score: number
          ai_summary: string
          tags?: string[]
          prompt_id: string
          prompt_version: string
          analyzed_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          sentiment_score?: number
          relevance_score?: number
          innovation_score?: number
          market_viability?: number
          trending_score?: number
          ai_summary?: string
          tags?: string[]
          prompt_id?: string
          prompt_version?: string
          analyzed_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      prompts: {
        Row: {
          id: string
          name: string
          template: string
          version: string
          is_active: boolean
          performance_metrics: PerformanceMetrics | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          template: string
          version: string
          is_active?: boolean
          performance_metrics?: PerformanceMetrics | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          template?: string
          version?: string
          is_active?: boolean
          performance_metrics?: PerformanceMetrics | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
