import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { JsonOutputParser } from '@langchain/core/output_parsers'
import { langsmithAdmin } from '../../lib/langsmith-admin.js'
import { loadFallbackPrompt } from './prompt-loader.js'
import { log } from './logger.js'

// AI Analysis function
export async function analyzePost(post) {
  try {
    const content = `Title: ${post.title}\n\nContent: ${post.selftext || 'No content'}`
    
    // Get the active prompt from LangSmith
    let activePrompt = null
    
    if (langsmithAdmin) {
      try {
        const prompts = await langsmithAdmin.getPrompts()
        activePrompt = prompts.find((p) => p.metadata.is_active)
      } catch (error) {
        await log('warn', 'Failed to fetch prompts from LangSmith', { error: error.message })
      }
    }

    let promptTemplate
    if (activePrompt) {
      await log('info', 'Using LangSmith prompt', { 
        promptId: activePrompt.id, 
        version: activePrompt.metadata.version 
      })
      
      // Check if this is a LangChain prompt object or a template string
      if (activePrompt.metadata.is_langchain_prompt && activePrompt.langchain_prompt) {
        console.log('Using LangChain Hub prompt directly')
        console.log('Prompt input variables:', activePrompt.langchain_prompt.inputVariables)
        
        // Check if the input variables look correct
        const inputVars = activePrompt.langchain_prompt.inputVariables || []
        const hasValidInputVars = inputVars.some(v => ['content', 'post', 'text'].includes(v)) || 
                                  (inputVars.length === 1 && inputVars[0].length < 50)
        
        if (hasValidInputVars) {
          promptTemplate = activePrompt.langchain_prompt
        } else {
          console.log('LangChain prompt has invalid input variables, falling back to main fallback prompt')
          console.log('Invalid variables:', inputVars)
          // Use the main fallback prompt instead
          activePrompt = null
        }
      } else {
        // Create LangChain prompt template from string
        console.log('LangSmith prompt content:', activePrompt.prompt.substring(0, 300) + '...')
        console.log('LangSmith prompt input variables expected:', activePrompt.prompt.match(/\{([^}]+)\}/g))
        promptTemplate = PromptTemplate.fromTemplate(activePrompt.prompt)
      }
    }

    // Handle fallback when activePrompt was invalidated
    if (!activePrompt) {
      await log('warn', 'No valid prompt found, loading fallback prompt from file')
      
      // Load fallback prompt from file
      const fallbackPromptContent = await loadFallbackPrompt()
      promptTemplate = PromptTemplate.fromTemplate(fallbackPromptContent)
    }

    // Initialize OpenAI model with LangSmith tracking
    const model = new ChatOpenAI({
      modelName: 'gpt-4.1-nano',
      temperature: 0.1,
      maxTokens: 500,
      metadata: {
        post_id: post.id,
        subreddit: post.subreddit || 'unknown',
        operation: 'reddit-post-analysis',
        prompt_id: activePrompt?.id || 'fallback',
        prompt_version: activePrompt?.metadata?.version || 'fallback'
      },
      tags: ['reddit-analysis', 'startup-monitoring', activePrompt ? `prompt-${activePrompt.metadata.version}` : 'fallback-prompt']
    })

    // Create output parser with format instructions
    const parser = new JsonOutputParser()

    // Create the chain
    const chain = promptTemplate.pipe(model).pipe(parser)

    // Execute the chain with LangSmith tracing
    console.log('Invoking chain with content length:', content.length)
    console.log('Content preview:', content.substring(0, 100) + '...')
    
    // Prepare input based on whether it's a LangChain prompt or template
    let chainInput
    if (activePrompt?.metadata?.is_langchain_prompt && promptTemplate === activePrompt.langchain_prompt) {
      // For valid LangChain Hub prompts, use the expected input variables
      const inputVars = activePrompt.langchain_prompt.inputVariables || ['content']
      console.log('Using LangChain Hub input variables:', inputVars)
      
      // Map our content to the first input variable (or try common ones)
      if (inputVars.includes('content')) {
        chainInput = { content: content }
      } else if (inputVars.includes('post')) {
        chainInput = { post: content }
      } else if (inputVars.includes('text')) {
        chainInput = { text: content }
      } else {
        // Use the first input variable
        chainInput = { [inputVars[0]]: content }
      }
      console.log('Chain input keys:', Object.keys(chainInput))
    } else {
      // For template prompts (including fallback), use our standard format
      chainInput = { content: content }
      console.log('Using standard template input: content')
    }
    
    let analysis
    try {
      analysis = await chain.invoke(chainInput)
    } catch (parseError) {
      await log('warn', 'JSON parsing failed, trying raw response', { error: parseError.message })
      
      // Try without parser to see raw response
      const rawChain = promptTemplate.pipe(model)
      const rawResponse = await rawChain.invoke(chainInput)
      
      await log('debug', 'Raw AI response', { response: rawResponse.content })
      
      // Try to extract JSON from the response
      const jsonMatch = rawResponse.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0])
        } catch (jsonError) {
          throw new Error(`Failed to parse extracted JSON: ${jsonError.message}`)
        }
      } else {
        throw new Error(`No JSON found in response: ${rawResponse.content}`)
      }
    }
    
    // Validate the analysis structure
    if (!analysis || typeof analysis !== 'object') {
      throw new Error('Invalid analysis response from AI')
    }
    
    // Ensure required fields exist with defaults
    const validatedAnalysis = {
      summary: analysis.summary || post.title.substring(0, 200),
      sentiment_score: typeof analysis.sentiment_score === 'number' ? analysis.sentiment_score : 0.5,
      relevance_score: typeof analysis.relevance_score === 'number' ? analysis.relevance_score : 0.5,
      innovation_score: typeof analysis.innovation_score === 'number' ? analysis.innovation_score : 0.5,
      market_viability: typeof analysis.market_viability === 'number' ? analysis.market_viability : 0.5,
      tags: Array.isArray(analysis.tags) ? analysis.tags : ['General'],
      // Include prompt information for analytics tracking
      prompt_id: activePrompt?.id || 'fallback',
      prompt_version: activePrompt?.metadata?.version || activePrompt?.metadata?.is_langchain_prompt ? 'latest' : 'fallback'
    }
    
    return validatedAnalysis
    
  } catch (error) {
    await log('error', 'AI analysis failed', { postId: post.id, error: error.message })
    
    // Return fallback analysis with prompt info
    return {
      summary: post.title.substring(0, 200),
      sentiment_score: 0.5,
      relevance_score: 0.5,
      innovation_score: 0.5,
      market_viability: 0.5,
      tags: ['Unanalyzed'],
      prompt_id: 'error',
      prompt_version: 'error'
    }
  }
} 