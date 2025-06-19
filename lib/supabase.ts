import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-anon-key"

// Create a single reusable client instance
export const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

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

// Database Types
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
  metadata?: Record<string, unknown>
  created_at: string
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
  created_at: string
}

export interface ChatMessage {
  id: string
  user_ip: string
  session_id: string
  message: string
  response: string
  role: 'user' | 'assistant'
  is_user_message: boolean
  metadata?: Record<string, unknown>
  tokens_used?: number
  response_time_ms?: number
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      posts: {
        Row: Post
        Insert: Omit<Post, "id" | "created_at">
        Update: Partial<Omit<Post, "id" | "created_at">>
      }
      post_analytics: {
        Row: PostAnalytics
        Insert: Omit<PostAnalytics, "id" | "created_at">
        Update: Partial<Omit<PostAnalytics, "id" | "created_at">>
      }
      chat: {
        Row: ChatMessage
        Insert: Omit<ChatMessage, "id" | "created_at">
        Update: Partial<Omit<ChatMessage, "id" | "created_at">>
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
