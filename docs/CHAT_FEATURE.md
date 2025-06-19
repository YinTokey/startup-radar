# StartupRadar AI Chat Feature

## Overview

The StartupRadar dashboard now includes an AI-powered chat assistant that helps users understand startup trends, market insights, and entrepreneurship topics.

## Features

### 🤖 AI Assistant
- **LangChain Integration**: Uses LangChain with OpenAI GPT-4o-mini for intelligent responses
- **Startup Focus**: Specialized prompts for startup-related conversations
- **Real-time Responses**: Fast, contextual answers about market trends and opportunities

### 💬 Chat Interface
- **Modern Dialog**: Clean, responsive chat interface with message bubbles
- **Real-time Updates**: Supabase subscriptions for live message updates
- **Session Management**: IP-based user identification with session tracking
- **Auto-scroll**: Automatically scrolls to latest messages
- **Response Time**: Shows AI response times for transparency

### 📊 Data Storage
- **Chat History**: All conversations stored in Supabase with full history
- **User Tracking**: IP-based user identification for session continuity
- **Analytics**: Response times and metadata for performance monitoring

## Database Schema

### Chat Table
```sql
CREATE TABLE chat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_ip TEXT NOT NULL,
  session_id TEXT NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  is_user_message BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  tokens_used INTEGER DEFAULT 0,
  response_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### POST `/api/chat`
Send a message to the AI assistant.

**Request Body:**
```json
{
  "message": "What are the latest startup trends?",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "response": "AI response text",
  "sessionId": "generated-or-provided-session-id",
  "responseTime": 1250
}
```

### GET `/api/chat?sessionId=xxx`
Retrieve chat history for a session.

**Response:**
```json
{
  "chatHistory": [
    {
      "id": "message-id",
      "content": "message content",
      "role": "user",
      "timestamp": "2024-01-15T10:30:00Z",
      "responseTime": 1250
    }
  ],
  "sessionId": "session-id"
}
```

## Usage

### Accessing the Chat
1. Click the "AI Chat" button in the dashboard header
2. A dialog will open with a welcome message
3. Type your startup-related questions
4. Press Enter or click Send to get AI responses

### Features Available
- Ask about startup trends and patterns
- Get market analysis insights
- Request investment and funding guidance
- Discuss innovation opportunities
- General entrepreneurship advice

### Real-time Updates
- Messages appear instantly in the chat
- Multiple users can see updates in real-time (if sharing sessions)
- Automatic reconnection if connection is lost

## Technical Implementation

### Components
- `components/chat-dialog.tsx` - Main chat interface
- `components/ui/dialog.tsx` - Dialog component (Radix UI)
- `components/ui/scroll-area.tsx` - Scroll area component (Radix UI)

### Backend
- `app/api/chat/route.ts` - Chat API with LangChain integration
- LangChain prompt templates for startup-focused responses
- Supabase real-time subscriptions for live updates

### Dependencies
```json
{
  "@langchain/openai": "^0.0.x",
  "@langchain/core": "^0.1.x", 
  "@radix-ui/react-dialog": "^1.0.x",
  "@radix-ui/react-scroll-area": "^1.0.x"
}
```

## Environment Variables Required

```env
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deployment Notes

1. Ensure all environment variables are set
2. Run database migration to create chat table:
   ```sql
   psql -h your-host -d your-db -f sql/setup-database.sql
   ```
3. Test chat functionality in development first
4. Monitor API usage and response times in production

## Future Enhancements

- [ ] Chat history persistence across sessions
- [ ] Message export functionality  
- [ ] Advanced analytics and insights
- [ ] Multi-language support
- [ ] Voice message support
- [ ] Integration with startup data for context-aware responses 