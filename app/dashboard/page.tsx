"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, MessageCircle, ArrowUp, Clock, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { ChatDialog } from "@/components/chat-dialog"

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
  const [searchTerm, setSearchTerm] = useState("")
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
  const [chatOpen, setChatOpen] = useState(false)

  const fetchPosts = useCallback(async (page = 1) => {
    try {
      setLoading(true)
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
      }
    } catch (error) {
      console.error("Error fetching posts:", error)
      setError("Failed to fetch posts")
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [selectedSubreddit, sortBy])

  useEffect(() => {
    fetchPosts(1) // Reset to page 1 when filters change
  }, [selectedSubreddit, sortBy])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchPosts(newPage)
    }
  }

  const filteredPosts = posts.filter(
    (post) =>
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.post_analytics?.[0]?.ai_summary || '').toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getSentimentColor = (score: number) => {
    if (score > 0.6) return "bg-green-100 text-green-800"
    if (score > 0.3) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
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

  if (loading && currentPage === 1) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading startup insights...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">StartupRadar Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                {pagination.total} Total Posts
              </Badge>
              <Button 
                onClick={() => setChatOpen(true)} 
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                AI Chat
              </Button>
              <Button onClick={() => fetchPosts(currentPage)} variant="outline" size="sm" disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search posts and summaries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={selectedSubreddit} onValueChange={setSelectedSubreddit}>
            <SelectTrigger className="w-48">
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
            <SelectTrigger className="w-48">
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
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
            <Button 
              onClick={() => fetchPosts(currentPage)} 
              variant="outline" 
              size="sm" 
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Posts Grid */}
        <div className="grid gap-6">
          {filteredPosts.map((post) => {
            const analytics = post.post_analytics?.[0];
            const hasAnalytics = !!analytics;
            
            return (
              <Card key={post.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">r/{post.subreddit}</Badge>
                        {hasAnalytics && (
                          <Badge className={getSentimentColor(analytics.sentiment_score)}>
                            {getSentimentLabel(analytics.sentiment_score)}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(post.created_at)}
                        </div>
                        {hasAnalytics && (
                          <Badge variant="secondary" className="text-xs">
                            {analytics.prompt_version}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg leading-tight mb-2">{post.title}</CardTitle>
                      <CardDescription className="text-sm">by u/{post.author}</CardDescription>
                    </div>
                    <div className="text-right">
                      {hasAnalytics ? (
                        <>
                          <div className="text-2xl font-bold text-blue-600">{analytics.trending_score}</div>
                          <div className="text-xs text-gray-500">Trending Score</div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-400">No analytics</div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {hasAnalytics ? (
                    <>
                      <div className="mb-4">
                        <h4 className="font-semibold text-sm mb-2">AI Summary:</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">{analytics.ai_summary}</p>
                      </div>

                      {/* Analytics Scores */}
                      <div className="mb-4 grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-semibold text-green-600">{Math.round(analytics.relevance_score * 100)}%</div>
                          <div className="text-xs text-gray-500">Relevance</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-purple-600">{Math.round(analytics.innovation_score * 100)}%</div>
                          <div className="text-xs text-gray-500">Innovation</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-orange-600">{Math.round(analytics.market_viability * 100)}%</div>
                          <div className="text-xs text-gray-500">Market Viability</div>
                        </div>
                      </div>

                      {analytics.tags && analytics.tags.length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-1">
                            {analytics.tags.map((tag: string, index: number) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mb-4 text-sm text-gray-500 italic">
                      This post hasn&apos;t been analyzed yet.
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <ArrowUp className="h-4 w-4" />
                        {post.upvotes}
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        {post.comments}
                      </div>
                      {hasAnalytics && (
                        <div className="text-xs text-gray-400">
                          Analyzed: {formatTimeAgo(analytics.analyzed_at)}
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={post.url} target="_blank" rel="noopener noreferrer">
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
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.hasPrev || loading}
              size="sm"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex items-center gap-2">
              {/* Show page numbers */}
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
                    className="w-10"
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
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Pagination Info */}
        {pagination.total > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} posts
          </div>
        )}

        {/* Empty State */}
        {filteredPosts.length === 0 && !loading && !error && (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts found</h3>
            <p className="text-gray-600">
              {pagination.total === 0 
                ? "No posts have been analyzed yet. Run the Reddit scraper to populate data."
                : "Try adjusting your search or filters"
              }
            </p>
          </div>
        )}
      </div>

      {/* Chat Dialog */}
      <ChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  )
}
