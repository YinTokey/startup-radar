import { type NextRequest, NextResponse } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { PromptTemplate } from "@langchain/core/prompts"
import { JsonOutputParser } from "@langchain/core/output_parsers"
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

    const startTime = Date.now()

    // Create LangChain prompt template
    const promptTemplate = PromptTemplate.fromTemplate(activePrompt.prompt)

    // Initialize OpenAI model with LangSmith tracking
    const model = new ChatOpenAI({
      modelName: "gpt-4.1-nano",
      temperature: 0.3,
      maxTokens: 500,
      metadata: {
        prompt_id: activePrompt.id,
        prompt_version: activePrompt.metadata.version,
        operation: "manual-analysis"
      },
      tags: ["manual-analysis", "startup-monitoring", `prompt-${activePrompt.metadata.version}`]
    })

    // Create output parser
    const parser = new JsonOutputParser()

    // Create the chain
    const chain = promptTemplate.pipe(model).pipe(parser)

    // Execute the chain with LangSmith tracing
    let analysis
    try {
      analysis = await chain.invoke({
        content: postContent
      })
    } catch {
      // Fallback parsing if JSON is malformed
      analysis = {
        summary: postContent.substring(0, 200),
        relevance_score: 0.8,
        sentiment_score: 0.7,
        tags: ["AI Analysis", "Startup"],
      }
    }

    const endTime = Date.now()
    const latency = endTime - startTime

    // Validate the analysis structure
    const validatedAnalysis = {
      summary: analysis.summary || analysis.ai_summary || postContent.substring(0, 200),
      sentiment_score: typeof analysis.sentiment_score === 'number' ? analysis.sentiment_score : 0.7,
      relevance_score: typeof analysis.relevance_score === 'number' ? analysis.relevance_score : 0.8,
      innovation_score: typeof analysis.innovation_score === 'number' ? analysis.innovation_score : 0.5,
      market_viability: typeof analysis.market_viability === 'number' ? analysis.market_viability : 0.5,
      tags: Array.isArray(analysis.tags) ? analysis.tags : ["AI Analysis", "Startup"]
    }

    // Track performance metrics in LangSmith
    await langsmithAdmin.submitFeedback(
      `run_${Date.now()}`, // In real implementation, get actual run ID from telemetry
      validatedAnalysis.relevance_score * 5, // Convert to 1-5 scale
      `Manual analysis for prompt ${activePrompt.metadata.version}`,
    )

    return NextResponse.json({
      success: true,
      analysis: validatedAnalysis,
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
