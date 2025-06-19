"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, MessageCircle, ArrowUp, Clock, Search } from "lucide-react"

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

export default function Dashboard() {
  const [posts, setPosts] = useState<PostWithAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSubreddit, setSelectedSubreddit] = useState("all")
  const [sortBy, setSortBy] = useState("trending_score")

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(
        `/api/posts?subreddit=${encodeURIComponent(selectedSubreddit)}&sortBy=${encodeURIComponent(sortBy)}`,
      )
      if (!res.ok) throw new Error("Network response was not ok")

      const { data } = (await res.json()) as { data: Post[] }
      setPosts(data || mockPosts)
    } catch (error) {
      console.error("Error fetching posts:", error)
      setPosts(mockPosts) // fallback demo data
    } finally {
      setLoading(false)
    }
  }, [selectedSubreddit, sortBy])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

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

  if (loading) {
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
              <Badge variant="secondary">{filteredPosts.length} Posts Analyzed</Badge>
              <Button onClick={fetchPosts} variant="outline" size="sm">
                Refresh
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

        {filteredPosts.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Mock data for demo purposes
const mockPosts: PostWithAnalytics[] = [
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
