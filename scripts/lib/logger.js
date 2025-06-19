// Simple logging utility
export async function log(level, message, data = null) {
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}${data ? ` ${JSON.stringify(data)}` : ''}`
  
  console.log(logEntry)
} 