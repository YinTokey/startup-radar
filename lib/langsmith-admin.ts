import { Client } from "langsmith"
import { AISDKExporter } from "langsmith/vercel"

// Initialize LangSmith client with proper configuration
const langsmithClient = new Client({
  apiUrl: process.env.LANGSMITH_API_URL || "https://api.smith.langchain.com",
  apiKey: process.env.LANGSMITH_API_KEY,
})

export interface LangSmithPrompt {
  id: string
  prompt_name: string
  prompt: string
  tags: string[]
  created_at: string
  updated_at: string
  metadata: {
    version: string
    description?: string
    is_active: boolean
    experiment_id?: string
  }
}

export interface LangSmithExperiment {
  id: string
  name: string
  description: string
  created_at: string
  status: "running" | "completed" | "paused"
  variants: {
    prompt_id: string
    prompt_name: string
    traffic_percentage: number
    metrics: {
      total_runs: number
      avg_score: number
      success_rate: number
      avg_latency: number
      total_cost: number
    }
  }[]
}

export interface LangSmithRun {
  id: string
  name: string
  run_type: string
  start_time: string
  end_time: string
  status: "success" | "error"
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  error?: string
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  total_cost?: number
  feedback_stats?: {
    avg_score: number
    score_count: number
  }
  tags: string[]
}

interface ExperimentVariant {
  prompt_id: string
  traffic_percentage: number
}

export class LangSmithAdmin {
  private client: Client
  private exporter: AISDKExporter

  constructor() {
    this.client = langsmithClient
    this.exporter = new AISDKExporter()
  }

  // Prompt Template Management
  async getPrompts(): Promise<LangSmithPrompt[]> {
    try {
      const prompts = await this.client.listPrompts({
        limit: 100,
        is_archived: false,
      })
      return prompts.map(this.mapPrompt)
    } catch (error) {
      console.error("Error fetching prompts:", error)
      return []
    }
  }

  async createPromptVersion(
    promptName: string,
    template: string,
    version: string,
    description?: string,
  ): Promise<LangSmithPrompt> {
    const prompt = await this.client.createPrompt({
      prompt_name: promptName,
      prompt: template,
      tags: [`version:${version}`, "reddit-startup-monitor"],
      metadata: {
        version,
        description,
        is_active: false,
      },
    })
    return this.mapPrompt(prompt)
  }

  async updatePrompt(promptId: string, updates: Partial<LangSmithPrompt>): Promise<LangSmithPrompt> {
    const prompt = await this.client.updatePrompt(promptId, {
      prompt: updates.prompt,
      tags: updates.tags,
      metadata: updates.metadata,
    })
    return this.mapPrompt(prompt)
  }

  async getPromptVersions(promptName: string): Promise<LangSmithPrompt[]> {
    const prompts = await this.client.listPrompts({
      query: promptName,
      limit: 50,
    })
    return prompts
      .map(this.mapPrompt)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  // A/B Testing & Experiments
  async createExperiment(
    name: string,
    description: string,
    promptVariants: { prompt_id: string; traffic_percentage: number }[],
  ): Promise<string> {
    // Create experiment using LangSmith's experiment framework
    const experiment = await this.client.createDataset({
      name: `experiment_${name}`,
      description,
      metadata: {
        type: "ab_test",
        variants: promptVariants,
        created_at: new Date().toISOString(),
      },
    })
    return experiment.id
  }

  async getExperiments(): Promise<LangSmithExperiment[]> {
    try {
      const datasets = await this.client.listDatasets({
        limit: 50,
      })

      const experiments = datasets.filter((d) => d.metadata?.type === "ab_test")

      const experimentsWithMetrics = await Promise.all(
        experiments.map(async (exp) => {
          const variants = exp.metadata?.variants || []
          const variantsWithMetrics = await Promise.all(
            variants.map(async (variant: ExperimentVariant) => {
              const runs = await this.getRuns({
                filter: `eq(metadata.prompt_id, "${variant.prompt_id}")`,
                limit: 1000,
              })

              const metrics = this.calculateVariantMetrics(runs)
              return {
                ...variant,
                metrics,
              }
            }),
          )

          return {
            id: exp.id,
            name: exp.name,
            description: exp.description || "",
            created_at: exp.created_at,
            status: exp.metadata?.status || "running",
            variants: variantsWithMetrics,
          }
        }),
      )

      return experimentsWithMetrics
    } catch (error) {
      console.error("Error fetching experiments:", error)
      return []
    }
  }

  async updateExperimentStatus(experimentId: string, status: "running" | "completed" | "paused"): Promise<void> {
    await this.client.updateDataset(experimentId, {
      metadata: { status },
    })
  }

  // API Usage & Cost Tracking
  async getUsageMetrics(timeRange: { start: Date; end: Date }): Promise<{
    total_runs: number
    total_cost: number
    total_tokens: number
    avg_latency: number
    success_rate: number
    daily_breakdown: Array<{
      date: string
      runs: number
      cost: number
      tokens: number
      avg_latency: number
    }>
  }> {
    try {
      const runs = await this.getRuns({
        filter: `gte(start_time, "${timeRange.start.toISOString()}") and lte(start_time, "${timeRange.end.toISOString()}")`,
        limit: 10000,
      })

      const totalRuns = runs.length
      const totalCost = runs.reduce((sum, run) => sum + (run.total_cost || 0), 0)
      const totalTokens = runs.reduce((sum, run) => sum + (run.total_tokens || 0), 0)
      const avgLatency =
        runs.reduce((sum, run) => {
          const latency = new Date(run.end_time).getTime() - new Date(run.start_time).getTime()
          return sum + latency
        }, 0) / totalRuns
      const successRate = runs.filter((run) => run.status === "success").length / totalRuns

      // Group by day for breakdown
      const dailyBreakdown = this.groupRunsByDay(runs)

      return {
        total_runs: totalRuns,
        total_cost: totalCost,
        total_tokens: totalTokens,
        avg_latency: avgLatency,
        success_rate: successRate,
        daily_breakdown: dailyBreakdown,
      }
    } catch (error) {
      console.error("Error fetching usage metrics:", error)
      return {
        total_runs: 0,
        total_cost: 0,
        total_tokens: 0,
        avg_latency: 0,
        success_rate: 0,
        daily_breakdown: [],
      }
    }
  }

  // Effectiveness Metrics & Evaluation
  async getPromptEffectiveness(promptId: string): Promise<{
    avg_score: number
    total_evaluations: number
    score_distribution: { score: number; count: number }[]
    recent_feedback: Array<{
      run_id: string
      score: number
      comment?: string
      created_at: string
    }>
  }> {
    try {
      const runs = await this.getRuns({
        filter: `eq(metadata.prompt_id, "${promptId}")`,
        limit: 1000,
      })

      const runsWithFeedback = runs.filter((run) => run.feedback_stats)
      const avgScore =
        runsWithFeedback.reduce((sum, run) => sum + (run.feedback_stats?.avg_score || 0), 0) / runsWithFeedback.length

      // Get feedback for this prompt
      const feedback = await this.client.listFeedback({
        run_ids: runs.map((r) => r.id),
        limit: 100,
      })

      const scoreDistribution = this.calculateScoreDistribution(feedback)
      const recentFeedback = feedback.slice(0, 10).map((f) => ({
        run_id: f.run_id,
        score: f.score,
        comment: f.comment,
        created_at: f.created_at,
      }))

      return {
        avg_score: avgScore || 0,
        total_evaluations: feedback.length,
        score_distribution: scoreDistribution,
        recent_feedback: recentFeedback,
      }
    } catch (error) {
      console.error("Error fetching prompt effectiveness:", error)
      return {
        avg_score: 0,
        total_evaluations: 0,
        score_distribution: [],
        recent_feedback: [],
      }
    }
  }

  async submitFeedback(runId: string, score: number, comment?: string): Promise<void> {
    await this.client.createFeedback({
      run_id: runId,
      key: "user_rating",
      score,
      comment,
    })
  }

  // Traceability & Monitoring
  async getRuns(
    options: {
      filter?: string
      limit?: number
      offset?: number
    } = {},
  ): Promise<LangSmithRun[]> {
    try {
      const runs = await this.client.listRuns({
        project_name: "reddit-startup-monitor",
        filter: options.filter,
        limit: options.limit || 100,
        offset: options.offset || 0,
      })
      return runs.map(this.mapRun)
    } catch (error) {
      console.error("Error fetching runs:", error)
      return []
    }
  }

  async getRunDetails(runId: string): Promise<LangSmithRun | null> {
    try {
      const run = await this.client.readRun(runId)
      return this.mapRun(run)
    } catch (error) {
      console.error("Error fetching run details:", error)
      return null
    }
  }

  async getRunTrace(runId: string): Promise<Record<string, unknown>> {
    try {
      const trace = await this.client.getRunTrace({ run_id: runId })
      return trace || {}
    } catch (error) {
      console.error("Error fetching run trace:", error)
      return {}
    }
  }

  // Helper methods
  private mapPrompt(prompt: Record<string, unknown>): LangSmithPrompt {
    return {
      id: prompt.id as string,
      prompt_name: prompt.prompt_name as string,
      prompt: prompt.prompt as string,
      tags: (prompt.tags as string[]) || [],
      created_at: prompt.created_at as string,
      updated_at: prompt.updated_at as string,
      metadata: {
        version: (prompt.metadata as Record<string, unknown>)?.version as string,
        description: (prompt.metadata as Record<string, unknown>)?.description as string,
        is_active: Boolean((prompt.metadata as Record<string, unknown>)?.is_active),
        experiment_id: (prompt.metadata as Record<string, unknown>)?.experiment_id as string,
      },
    }
  }

  private mapRun(run: Record<string, unknown>): LangSmithRun {
    return {
      id: run.id as string,
      name: run.name as string,
      run_type: run.run_type as string,
      start_time: run.start_time as string,
      end_time: run.end_time as string,
      status: (run.status as "success" | "error") || "success",
      inputs: (run.inputs as Record<string, unknown>) || {},
      outputs: (run.outputs as Record<string, unknown>) || {},
      error: run.error as string,
      total_tokens: run.total_tokens as number,
      prompt_tokens: run.prompt_tokens as number,
      completion_tokens: run.completion_tokens as number,
      total_cost: run.total_cost as number,
      tags: (run.tags as string[]) || [],
    }
  }

  private calculateVariantMetrics(runs: LangSmithRun[]) {
    const totalRuns = runs.length
    const successfulRuns = runs.filter((r) => r.status === "success")
    const avgLatency =
      runs.reduce((sum, run) => {
        const latency = new Date(run.end_time).getTime() - new Date(run.start_time).getTime()
        return sum + latency
      }, 0) / totalRuns

    return {
      total_runs: totalRuns,
      avg_score: runs.reduce((sum, run) => sum + (run.feedback_stats?.avg_score || 0), 0) / totalRuns,
      success_rate: successfulRuns.length / totalRuns,
      avg_latency: avgLatency,
      total_cost: runs.reduce((sum, run) => sum + (run.total_cost || 0), 0),
    }
  }

  private groupRunsByDay(runs: LangSmithRun[]) {
    const grouped = runs.reduce(
      (acc, run) => {
        const date = new Date(run.start_time).toISOString().split("T")[0]
        if (!acc[date]) {
          acc[date] = []
        }
        acc[date].push(run)
        return acc
      },
      {} as Record<string, LangSmithRun[]>,
    )

    return Object.entries(grouped).map(([date, dayRuns]) => ({
      date,
      runs: dayRuns.length,
      cost: dayRuns.reduce((sum, run) => sum + (run.total_cost || 0), 0),
      tokens: dayRuns.reduce((sum, run) => sum + (run.total_tokens || 0), 0),
      avg_latency:
        dayRuns.reduce((sum, run) => {
          const latency = new Date(run.end_time).getTime() - new Date(run.start_time).getTime()
          return sum + latency
        }, 0) / dayRuns.length,
    }))
  }

  private calculateScoreDistribution(feedback: Array<{ score: number }>) {
    const distribution = new Map<number, number>()
    
    feedback.forEach((f) => {
      const score = Math.round(f.score)
      distribution.set(score, (distribution.get(score) || 0) + 1)
    })

    return Array.from(distribution.entries()).map(([score, count]) => ({
      score,
      count,
    }))
  }
}

export const langsmithAdmin = new LangSmithAdmin()
