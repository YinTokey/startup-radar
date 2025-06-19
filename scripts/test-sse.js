#!/usr/bin/env node

console.log('Testing SSE connection and environment variables...')

// Check environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
  'SUPABASE_SERVICE_ROLE_KEY'
]

console.log('\n📋 Environment Variables Check:')
let missingVars = []

requiredEnvVars.forEach(varName => {
  const value = process.env[varName]
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`)
  } else {
    console.log(`❌ ${varName}: Missing`)
    missingVars.push(varName)
  }
})

if (missingVars.length > 0) {
  console.log(`\n🚨 Missing environment variables: ${missingVars.join(', ')}`)
  console.log('Please add these to your .env.local file')
  process.exit(1)
}

// Test SSE connection
console.log('\n🔌 Testing SSE connection...')

const testSSE = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/events')
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    console.log('✅ SSE endpoint is accessible')
    console.log('📡 Response headers:')
    for (const [key, value] of response.headers.entries()) {
      if (key.includes('content') || key.includes('cache') || key.includes('access')) {
        console.log(`   ${key}: ${value}`)
      }
    }
    
    // Test reading the stream
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    
    console.log('\n📺 SSE Messages (first 3):')
    let messageCount = 0
    
    while (messageCount < 3) {
      const { done, value } = await reader.read()
      
      if (done) {
        console.log('Stream ended')
        break
      }
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            console.log(`   📨 ${data.type}: ${data.status || data.eventType || 'N/A'}`)
            messageCount++
            
            if (messageCount >= 3) break
          } catch {
            console.log(`   📨 Raw: ${line}`)
          }
        }
      }
    }
    
    reader.cancel()
    console.log('\n✅ SSE test completed successfully!')
    
  } catch (error) {
    console.error('\n❌ SSE test failed:', error.message)
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Make sure your Next.js dev server is running: npm run dev')
    }
  }
}

// Run test if server is available
const isDevServerRunning = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/posts?page=1&limit=1')
    return response.ok
  } catch {
    return false
  }
}

isDevServerRunning().then(running => {
  if (running) {
    testSSE()
  } else {
    console.log('\n⚠️  Dev server not running. Start it with: npm run dev')
    console.log('Then run this test again.')
  }
}) 