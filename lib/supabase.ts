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
          trending_score: number
          sentiment_score: number
          ai_summary: string
          relevance_score: number
          created_at: string
          updated_at: string
          tags: string[]
          url: string
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
          trending_score: number
          sentiment_score: number
          ai_summary: string
          relevance_score: number
          created_at?: string
          updated_at?: string
          tags?: string[]
          url: string
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
          trending_score?: number
          sentiment_score?: number
          ai_summary?: string
          relevance_score?: number
          created_at?: string
          updated_at?: string
          tags?: string[]
          url?: string
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
      api_usage: {
        Row: {
          id: string
          endpoint: string
          prompt_id: string
          tokens_used: number
          cost: number
          latency: number
          created_at: string
        }
        Insert: {
          id?: string
          endpoint: string
          prompt_id: string
          tokens_used: number
          cost: number
          latency: number
          created_at?: string
        }
        Update: {
          id?: string
          endpoint?: string
          prompt_id?: string
          tokens_used?: number
          cost?: number
          latency?: number
          created_at?: string
        }
      }
    }
  }
}
