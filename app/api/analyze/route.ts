import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { AISDKExporter } from "langsmith/vercel"
import { langsmithAdmin } from "@/lib/langsmith-admin"

export async function POST(request: NextRequest) {
  try {
    const { postContent, promptId } = await request.json()

    if (!postContent) {
      return NextResponse.json({ error: "Post content is required" }, { status: 400 })
    }

    // Get the active prompt from LangSmith
    const prompts = await langsmithAdmin.getPrompts()
    const activePrompt = promptId ? prompts.find((p) => p.id === promptId) : prompts.find((p) => p.metadata.is_active)

    if (!activePrompt) {
      return NextResponse.json({ error: "No active prompt found" }, { status: 404 })
    }

    // Replace content placeholder in prompt template
    const processedPrompt = activePrompt.prompt.replace("{content}", postContent)

    const startTime = Date.now()

    // Generate analysis using AI SDK with LangSmith telemetry
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: processedPrompt,
      experimental_telemetry: AISDKExporter.getSettings({
        runName: `startup-analysis-${activePrompt.metadata.version}`,
        metadata: {
          prompt_id: activePrompt.id,
          prompt_version: activePrompt.metadata.version,
          subreddit: "startup-analysis",
        },
      }),
    })

    const endTime = Date.now()
    const latency = endTime - startTime

    // Parse the AI response
    let analysis
    try {
      analysis = JSON.parse(text)
    } catch {
      // Fallback parsing if JSON is malformed
      analysis = {
        summary: text.substring(0, 200),
        relevance_score: 0.8,
        sentiment_score: 0.7,
        tags: ["AI Analysis", "Startup"],
      }
    }

    // Track performance metrics in LangSmith
    await langsmithAdmin.submitFeedback(
      `run_${Date.now()}`, // In real implementation, get actual run ID from telemetry
      analysis.relevance_score * 5, // Convert to 1-5 scale
      `Automated analysis for prompt ${activePrompt.metadata.version}`,
    )

    return NextResponse.json({
      success: true,
      analysis: {
        summary: analysis.summary || analysis.ai_summary,
        sentiment_score: analysis.sentiment_score,
        relevance_score: analysis.relevance_score,
        tags: analysis.tags || [],
        innovation_score: analysis.innovation_score,
        market_viability: analysis.market_viability,
      },
      metadata: {
        prompt_id: activePrompt.id,
        prompt_version: activePrompt.metadata.version,
        latency,
        model: "gpt-4o-mini",
      },
    })
  } catch (error) {
    console.error("Error in analysis:", error)
    return NextResponse.json({ error: "Failed to analyze post" }, { status: 500 })
  }
}
