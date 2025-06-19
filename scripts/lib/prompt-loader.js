import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get directory paths for file imports
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load fallback prompt template
export async function loadFallbackPrompt() {
  try {
    const promptPath = join(__dirname, '../prompts/fallback-prompt.txt')
    const promptContent = await fs.readFile(promptPath, 'utf-8')
    return promptContent.trim()
  } catch (error) {
    console.error('Failed to load fallback prompt, using hardcoded version:', error.message)
    // Hardcoded fallback as last resort
    return `You are a startup analyst. Analyze this Reddit post and return ONLY a JSON object with the exact structure shown below. Do not include any explanatory text, greeting, or additional commentary.

REQUIRED JSON FORMAT:
{
  "summary": "Brief 1-2 sentence summary of the post",
  "sentiment_score": 0.8,
  "relevance_score": 0.9,
  "innovation_score": 0.7,
  "market_viability": 0.6,
  "tags": ["AI", "SaaS", "B2B"]
}

SCORING CRITERIA (0.0 to 1.0):
- sentiment_score: Overall positivity/excitement in the post
- relevance_score: How relevant this is to startups/business
- innovation_score: How novel/innovative the idea is
- market_viability: Commercial potential assessment

POST TO ANALYZE:
{content}

RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT:`
  }
} 