import { Client } from "langsmith"
import { AISDKExporter } from "langsmith/vercel"
import * as hub from "langchain/hub"

// Initialize LangSmith client with proper configuration
const langsmithClient = new Client({
  apiUrl: process.env.LANGSMITH_API_URL || "https://api.smith.langchain.com",
  apiKey: process.env.LANGSMITH_API_KEY,
})

export class LangSmithAdmin {
  constructor() {
    this.client = langsmithClient
    this.exporter = new AISDKExporter()
  }

  // Prompt Template Management
  async getPrompts() {
    try {
      console.log('Attempting to fetch latest prompts from LangChain Hub...')
      
      // Try LangChain Hub approach first (recommended method)
      try {
        console.log('Pulling latest prompt from LangChain Hub: startup-analysis-2')
        const hubPrompt = await hub.pull("startup-analysis-2")
        
        console.log('Successfully pulled latest prompt from hub')
        console.log('Hub prompt type:', typeof hubPrompt, hubPrompt.constructor.name)
        console.log('Hub prompt keys:', Object.keys(hubPrompt))
        
        // Return the hub prompt directly for LangChain usage
        const convertedPrompt = {
          id: 'startup-analysis-2',
          prompt_name: 'startup-analysis-2',
          prompt: hubPrompt, // Store the actual LangChain prompt object
          langchain_prompt: hubPrompt, // Keep reference to original
          tags: ['hub', 'startup-analysis', 'latest'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            version: 'latest',
            description: 'Latest startup radar analysis prompt from LangChain Hub',
            is_active: true,
            experiment_id: null,
            is_langchain_prompt: true, // Flag to indicate this is a LangChain prompt object
          },
        }
        
        console.log('LangChain Hub latest prompt ready for direct use')
        return [convertedPrompt]
        
      } catch (hubError) {
        console.log('LangChain Hub approach failed:', hubError.message)
        console.log('Falling back to direct LangSmith API for latest prompts...')
      }
      
      // Fallback to direct LangSmith API - fetch latest prompts ordered by creation time
      try {
        const promptsList = []
        const iterator = this.client.listPrompts({
          limit: 10, // Get more prompts to find the latest
          is_archived: false,
          order: 'desc', // Order by creation time descending (latest first)
        })
        
        console.log('Got iterator, attempting to collect latest prompts...')
        let count = 0
        for await (const prompt of iterator) {
          promptsList.push(prompt)
          count++
          console.log(`Collected ${count} prompts...`)
          if (count >= 10) break // Get up to 10 to find the latest active one
        }
        
        console.log(`Successfully collected ${promptsList.length} prompts`)
        
        // Sort by updated_at to get the most recent version
        const sortedPrompts = promptsList.sort((a, b) => 
          new Date(b.updated_at || b.created_at).getTime() - 
          new Date(a.updated_at || a.created_at).getTime()
        )
        
        console.log('Prompts sorted by latest update time')
        
        return sortedPrompts.map(this.mapPrompt.bind(this))
        
      } catch (iteratorError) {
        console.log('Iterator approach failed, trying original method:', iteratorError.message)
      }
      
      // Fallback to original approach with better ordering
      const prompts = await this.client.listPrompts({
        limit: 10,
        is_archived: false,
        order: 'desc', // Latest first
      })
      console.log('Prompts type:', typeof prompts, prompts.constructor.name)
      
      // Check if it's an AsyncGenerator and convert to array
      const promptsArray = []
      
      if (prompts && typeof prompts[Symbol.asyncIterator] === 'function') {
        console.log('Converting AsyncGenerator to array...')
        let count = 0
        
        // Add timeout protection
        const timeout = setTimeout(() => {
          console.error('Timeout: AsyncGenerator taking too long, stopping...')
          throw new Error('AsyncGenerator timeout')
        }, 30000) // 30 seconds timeout
        
        try {
          for await (const prompt of prompts) {
            promptsArray.push(prompt)
            count++
            console.log(`Processed ${count} prompts...`)
            
            // Get up to 10 prompts to find the latest
            if (count >= 10) {
              console.log('Reached limit of 10 prompts, stopping...')
              break
            }
          }
        } finally {
          clearTimeout(timeout)
        }
        
        console.log(`Total prompts collected: ${promptsArray.length}`)
      } else if (Array.isArray(prompts)) {
        console.log('Prompts is already an array')
        promptsArray.push(...prompts)
      } else {
        console.log('Unexpected prompts format:', prompts)
        return []
      }
      
      // Sort by updated_at/created_at to get latest version first
      const sortedPrompts = promptsArray.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime()
        const dateB = new Date(b.updated_at || b.created_at).getTime()
        return dateB - dateA // Latest first
      })
      
      console.log('Found latest prompts:', sortedPrompts.map(p => ({
        id: p.id,
        name: p.prompt_name,
        version: p.metadata?.version,
        updated: p.updated_at || p.created_at
      })))
      
      return sortedPrompts.map(this.mapPrompt.bind(this))
    } catch (error) {
      console.error("Error fetching latest prompts:", error)
      return []
    }
  }

  async createPromptVersion(
    promptName,
    template,
    version,
    description
  ) {
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

  async updatePrompt(promptId, updates) {
    const prompt = await this.client.updatePrompt(promptId, {
      prompt: updates.prompt,
      tags: updates.tags,
      metadata: updates.metadata,
    })
    return this.mapPrompt(prompt)
  }

  async getPromptVersions(promptName) {
    const prompts = await this.client.listPrompts({
      query: promptName,
      limit: 50,
    })
    
    // Convert AsyncGenerator to array
    const promptsArray = []
    for await (const prompt of prompts) {
      promptsArray.push(prompt)
    }
    
    return promptsArray
      .map(this.mapPrompt.bind(this))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  // A/B Testing & Experiments
  async createExperiment(
    name,
    description,
    promptVariants
  ) {
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

  async getExperiments() {
    try {
      const datasetsGenerator = await this.client.listDatasets({
        limit: 50,
      })
      
      // Convert AsyncGenerator to array
      const datasets = []
      for await (const dataset of datasetsGenerator) {
        datasets.push(dataset)
      }

      const experiments = datasets.filter((d) => d.metadata?.type === "ab_test")

      const experimentsWithMetrics = await Promise.all(
        experiments.map(async (exp) => {
          const variants = exp.metadata?.variants || []
          const variantsWithMetrics = await Promise.all(
            variants.map(async (variant) => {
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

  async updateExperimentStatus(experimentId, status) {
    await this.client.updateDataset(experimentId, {
      metadata: { status },
    })
  }

  // API Usage & Cost Tracking
  async getUsageMetrics(timeRange) {
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
  async getPromptEffectiveness(promptId) {
    try {
      const runs = await this.getRuns({
        filter: `eq(metadata.prompt_id, "${promptId}")`,
        limit: 1000,
      })

      const runsWithFeedback = runs.filter((run) => run.feedback_stats)
      const avgScore =
        runsWithFeedback.reduce((sum, run) => sum + (run.feedback_stats?.avg_score || 0), 0) / runsWithFeedback.length

      // Get feedback for this prompt
      const feedbackGenerator = await this.client.listFeedback({
        run_ids: runs.map((r) => r.id),
        limit: 100,
      })
      
      // Convert AsyncGenerator to array
      const feedback = []
      for await (const fb of feedbackGenerator) {
        feedback.push(fb)
      }

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

  async submitFeedback(runId, score, comment) {
    await this.client.createFeedback({
      run_id: runId,
      key: "user_rating",
      score,
      comment,
    })
  }

  // Traceability & Monitoring
  async getRuns(options = {}) {
    try {
      const runsGenerator = await this.client.listRuns({
        project_name: "reddit-startup-monitor",
        filter: options.filter,
        limit: options.limit || 100,
        offset: options.offset || 0,
      })
      
      // Convert AsyncGenerator to array
      const runs = []
      for await (const run of runsGenerator) {
        runs.push(run)
      }
      
      return runs.map(this.mapRun.bind(this))
    } catch (error) {
      console.error("Error fetching runs:", error)
      return []
    }
  }

  async getRunDetails(runId) {
    try {
      const run = await this.client.readRun(runId)
      return this.mapRun(run)
    } catch (error) {
      console.error("Error fetching run details:", error)
      return null
    }
  }

  async getRunTrace(runId) {
    try {
      const trace = await this.client.getRunTrace({ run_id: runId })
      return trace || {}
    } catch (error) {
      console.error("Error fetching run trace:", error)
      return {}
    }
  }

  // Helper methods
  mapPrompt(prompt) {
    return {
      id: prompt.id,
      prompt_name: prompt.prompt_name,
      prompt: prompt.prompt,
      tags: prompt.tags || [],
      created_at: prompt.created_at,
      updated_at: prompt.updated_at,
      metadata: {
        version: prompt.metadata?.version,
        description: prompt.metadata?.description,
        is_active: Boolean(prompt.metadata?.is_active),
        experiment_id: prompt.metadata?.experiment_id,
      },
    }
  }

  mapRun(run) {
    return {
      id: run.id,
      name: run.name,
      run_type: run.run_type,
      start_time: run.start_time,
      end_time: run.end_time,
      status: run.status || "success",
      inputs: run.inputs || {},
      outputs: run.outputs || {},
      error: run.error,
      total_tokens: run.total_tokens,
      prompt_tokens: run.prompt_tokens,
      completion_tokens: run.completion_tokens,
      total_cost: run.total_cost,
      tags: run.tags || [],
    }
  }

  calculateVariantMetrics(runs) {
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

  groupRunsByDay(runs) {
    const grouped = runs.reduce(
      (acc, run) => {
        const date = new Date(run.start_time).toISOString().split("T")[0]
        if (!acc[date]) {
          acc[date] = []
        }
        acc[date].push(run)
        return acc
      },
      {}
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

  calculateScoreDistribution(feedback) {
    const distribution = new Map()
    
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