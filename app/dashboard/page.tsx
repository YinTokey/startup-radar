"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, MessageSquare, ArrowUp, Clock, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"

interface Post {
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

interface PostAnalytics {
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

interface PostWithAnalytics extends Post {
  post_analytics?: PostAnalytics[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface ApiResponse {
  data: PostWithAnalytics[]
  pagination: Pagination
  error?: string
}

export default function Dashboard() {
  const [posts, setPosts] = useState<PostWithAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubreddit, setSelectedSubreddit] = useState("all")
  const [sortBy, setSortBy] = useState("trending_score")
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  const [error, setError] = useState<string | null>(null)
  const [isRealTimeUpdate, setIsRealTimeUpdate] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected')

  const fetchPosts = useCallback(async (page = 1, isRealTime = false) => {
    try {
      if (!isRealTime) {
        setLoading(true)
      } else {
        setIsRealTimeUpdate(true)
      }
      setError(null)
      
      const params = new URLSearchParams({
        subreddit: selectedSubreddit,
        sortBy,
        page: page.toString()
      })
      
      const res = await fetch(`/api/posts?${params}`)
      if (!res.ok) throw new Error("Network response was not ok")

      const response = (await res.json()) as ApiResponse
      
      if (response.error) {
        setError(response.error)
        setPosts([])
      } else {
        setPosts(response.data || [])
        setPagination(response.pagination)
        setCurrentPage(page)
        
        if (isRealTime) {
          // Show a brief indicator that data was updated
          console.log('Real-time update: New posts detected')
        }
      }
    } catch (error) {
      console.error("Error fetching posts:", error)
      setError("Failed to fetch posts")
      setPosts([])
    } finally {
      setLoading(false)
      if (isRealTime) {
        setTimeout(() => setIsRealTimeUpdate(false), 2000) // Show indicator for 2 seconds
      }
    }
  }, [selectedSubreddit, sortBy])

  // Set up Server-Sent Events for real-time updates
  useEffect(() => {
    console.log('Setting up SSE connection for real-time updates...')
    
    const eventSource = new EventSource('/api/events')
    
    eventSource.onopen = () => {
      console.log('SSE: Connection opened')
      setConnectionStatus('connected')
    }
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('SSE: Received message:', data)
        
        switch (data.type) {
          case 'connection':
            setConnectionStatus('connected')
            break
            
          case 'subscription_status':
            setConnectionStatus(data.status)
            console.log('SSE: Subscription status:', data.status)
            break
            
          case 'posts_change':
            console.log('SSE: Posts table changed:', data.eventType)
            if (data.eventType === 'INSERT') {
              // New post added, refresh current page
              fetchPosts(currentPage, true)
            }
            break
            
          case 'analytics_change':
            console.log('SSE: Analytics table changed:', data.eventType)
            if (data.eventType === 'INSERT') {
              // New analytics added, refresh current page
              fetchPosts(currentPage, true)
            }
            break
            
          case 'error':
            console.error('SSE: Server error:', data.error)
            setConnectionStatus('error')
            break
            
          case 'ping':
            // Keep-alive ping, no action needed
            break
            
          default:
            console.log('SSE: Unknown message type:', data.type)
        }
      } catch (error) {
        console.error('SSE: Error parsing message:', error)
      }
    }
    
    eventSource.onerror = (error) => {
      console.error('SSE: Connection error:', error)
      setConnectionStatus('error')
    }

    // Cleanup on unmount
    return () => {
      console.log('SSE: Closing connection')
      eventSource.close()
    }
  }, [currentPage, fetchPosts])

  useEffect(() => {
    fetchPosts(1) // Reset to page 1 when filters change
  }, [selectedSubreddit, sortBy])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchPosts(newPage)
    }
  }

  const getSentimentColor = (score: number) => {
    if (score > 0.6) return "bg-emerald-50 text-emerald-700 border-emerald-200"
    if (score > 0.3) return "bg-amber-50 text-amber-700 border-amber-200"
    return "bg-red-50 text-red-700 border-red-200"
  }

  const getSentimentLabel = (score: number) => {
    if (score > 0.6) return "Positive"
    if (score > 0.3) return "Neutral"
    return "Negative"
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${diffInHours}h ago`
    return `${Math.floor(diffInHours / 24)}d ago`
  }

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'SUBSCRIBED':
      case 'connected':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'error':
      case 'CHANNEL_ERROR':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'TIMED_OUT':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  if (loading && currentPage === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 text-blue-600 animate-pulse mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading startup insights...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">StartupRadar</h1>
                <p className="text-sm text-slate-600">AI-Powered Startup Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">
                {pagination.total} Posts Analyzed
              </Badge>
              {isRealTimeUpdate && (
                <Badge className="bg-green-100 text-green-700 border-green-200 animate-pulse">
                  Updating...
                </Badge>
              )}
              <Badge variant="outline" className={`text-xs ${getConnectionStatusColor(connectionStatus)}`}>
                Real-time: {connectionStatus}
              </Badge>
              <Button 
                onClick={() => fetchPosts(currentPage)} 
                variant="outline" 
                size="sm" 
                disabled={loading}
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Filters */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <Select value={selectedSubreddit} onValueChange={setSelectedSubreddit}>
            <SelectTrigger className="w-64 bg-white border-slate-200">
              <SelectValue placeholder="Filter by subreddit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subreddits</SelectItem>
              <SelectItem value="saas">r/saas</SelectItem>
              <SelectItem value="sideprojects">r/sideprojects</SelectItem>
              <SelectItem value="startup">r/startup</SelectItem>
              <SelectItem value="startupideas">r/startupideas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-64 bg-white border-slate-200">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trending_score">Trending Score</SelectItem>
              <SelectItem value="upvotes">Upvotes</SelectItem>
              <SelectItem value="comments">Comments</SelectItem>
              <SelectItem value="created_at">Recent</SelectItem>
              <SelectItem value="relevance_score">Relevance</SelectItem>
              <SelectItem value="innovation_score">Innovation</SelectItem>
              <SelectItem value="market_viability">Market Viability</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-800 font-medium">{error}</p>
            <Button 
              onClick={() => fetchPosts(currentPage)} 
              variant="outline" 
              size="sm" 
              className="mt-3 border-red-200 text-red-700 hover:bg-red-100"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Posts Grid */}
        <div className="space-y-6">
          {posts.map((post) => {
            const analytics = post.post_analytics?.[0];
            const hasAnalytics = !!analytics;
            
            return (
              <Card key={post.id} className="group hover:shadow-xl transition-all duration-300 bg-white border-slate-200 hover:border-blue-200">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-300 font-medium">
                          r/{post.subreddit}
                        </Badge>
                        {hasAnalytics && (
                          <Badge className={`border ${getSentimentColor(analytics.sentiment_score)} font-medium`}>
                            {getSentimentLabel(analytics.sentiment_score)}
                          </Badge>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(post.created_at)}
                        </div>
                        {hasAnalytics && (
                          <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {analytics.prompt_version}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl leading-tight text-slate-900 group-hover:text-blue-900 transition-colors">
                        {post.title}
                      </CardTitle>
                      <CardDescription className="text-slate-600 font-medium">
                        by u/{post.author}
                      </CardDescription>
                    </div>
                    <div className="text-right ml-6">
                      {hasAnalytics ? (
                        <div className="space-y-1">
                          <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            {analytics.trending_score}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">Trending Score</div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">No analytics</div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {hasAnalytics ? (
                    <>
                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-900">AI Summary</h4>
                        <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">
                          {analytics.ai_summary}
                        </p>
                      </div>

                      {/* Analytics Scores */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                          <div className="text-2xl font-bold text-emerald-600">{Math.round(analytics.relevance_score * 100)}%</div>
                          <div className="text-sm text-emerald-700 font-medium mt-1">Relevance</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="text-2xl font-bold text-purple-600">{Math.round(analytics.innovation_score * 100)}%</div>
                          <div className="text-sm text-purple-700 font-medium mt-1">Innovation</div>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="text-2xl font-bold text-orange-600">{Math.round(analytics.market_viability * 100)}%</div>
                          <div className="text-sm text-orange-700 font-medium mt-1">Market Viability</div>
                        </div>
                      </div>

                      {analytics.tags && analytics.tags.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-slate-900">Tags</h4>
                          <div className="flex flex-wrap gap-2">
                            {analytics.tags.map((tag: string, index: number) => (
                              <Badge key={index} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-slate-500">This post hasn&apos;t been analyzed yet.</div>
                      <div className="text-sm text-slate-400 mt-1">Run the Reddit scraper to generate insights</div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-6 text-slate-600">
                      <div className="flex items-center gap-2">
                        <ArrowUp className="h-4 w-4" />
                        <span className="font-medium">{post.upvotes}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span className="font-medium">{post.comments}</span>
                      </div>
                      {hasAnalytics && (
                        <div className="text-sm text-slate-400">
                          Analyzed {formatTimeAgo(analytics.analyzed_at)}
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" asChild className="border-slate-200 text-slate-700 hover:bg-slate-50">
                      <a href={post.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        View on Reddit
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.hasPrev || loading}
              size="sm"
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNumber = Math.max(1, currentPage - 2) + i;
                if (pageNumber > pagination.totalPages) return null;
                
                return (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === currentPage ? "default" : "outline"}
                    onClick={() => handlePageChange(pageNumber)}
                    disabled={loading}
                    size="sm"
                    className={`w-10 ${pageNumber === currentPage 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.hasNext || loading}
              size="sm"
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Pagination Info */}
        {pagination.total > 0 && (
          <div className="mt-6 text-center text-sm text-slate-600">
            Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} posts
          </div>
        )}

        {/* Empty State */}
        {posts.length === 0 && !loading && !error && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <TrendingUp className="h-16 w-16 text-slate-400 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-slate-900 mb-3">No posts found</h3>
            <p className="text-slate-600 max-w-md mx-auto">
              {pagination.total === 0 
                ? "No posts have been analyzed yet. Run the Reddit scraper to populate data and start discovering startup trends."
                : "Try adjusting your filters to see more results."
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
