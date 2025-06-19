import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Zap, Eye, BarChart3 } from "lucide-react"
import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">StartupRadar</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            AI-Powered Startup Intelligence
          </Badge>
          <h2 className="text-5xl font-bold text-gray-900 mb-6">Discover Trending Startup Ideas from Reddit</h2>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Monitor r/saas, r/sideprojects, r/startup, and r/startupideas in real-time. Get AI-powered analysis,
            sentiment scoring, and trending insights powered by LangSmith.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" className="px-8">
                Start Monitoring
                <TrendingUp className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="lg">
              View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need to Track Startup Trends</h3>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Powered by OpenAI and LangSmith for the most comprehensive startup intelligence platform.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <Zap className="h-12 w-12 text-blue-600 mb-4" />
              <CardTitle>LangSmith-Powered Analysis</CardTitle>
              <CardDescription>
                Native prompt management, A/B testing, and performance tracking through LangSmith
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Prompt versioning & experimentation</li>
                <li>• Automatic cost & usage tracking</li>
                <li>• Real-time performance metrics</li>
                <li>• Complete request traceability</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Eye className="h-12 w-12 text-green-600 mb-4" />
              <CardTitle>Multi-Subreddit Monitoring</CardTitle>
              <CardDescription>Track multiple startup communities simultaneously with unified insights</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• r/saas discussions</li>
                <li>• r/sideprojects showcases</li>
                <li>• r/startup conversations</li>
                <li>• r/startupideas brainstorming</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="h-12 w-12 text-purple-600 mb-4" />
              <CardTitle>Advanced Analytics</CardTitle>
              <CardDescription>
                Professional-grade analytics and monitoring through LangSmith integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• A/B testing & experimentation</li>
                <li>• Cost optimization insights</li>
                <li>• Performance benchmarking</li>
                <li>• Team collaboration tools</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to Discover the Next Big Startup Idea?</h3>
          <p className="text-xl mb-8 text-blue-100">
            Join the community of entrepreneurs using AI-powered startup intelligence with LangSmith.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" variant="secondary" className="px-8">
                Get Started Now
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingUp className="h-6 w-6" />
            <span className="text-lg font-semibold">StartupRadar</span>
          </div>
          <p className="text-sm">AI-powered startup intelligence with LangSmith integration</p>
        </div>
      </footer>
    </div>
  )
}
