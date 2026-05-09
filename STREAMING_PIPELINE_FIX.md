# Streaming Pipeline Integration Fix

## Problem
The initial streaming implementation bypassed the entire AI query pipeline (Bloom detection, competency mapping, RAG, confidence layer, memory management, logging) and called the LLM directly. This meant streaming responses lacked:
- Curriculum alignment (CBC competency mapping)
- Pedagogy awareness (Bloom's taxonomy)
- Context retrieval (RAG with course-scoped documents)
- Intelligent confidence gating
- Conversation memory
- Pipeline logging and tracing

## Solution
Integrated streaming directly into the existing `ai_query.py` pipeline orchestrator.

---

## Backend Changes

### `/backend/app/routes/ai_query.py`

**Added:**
1. **`run_ai_pipeline_streaming()` function**: Async generator that runs the full AI pipeline with streaming LLM generation
   - Validates session and retrieves course_id
   - Stores user message in database
   - Runs Intelligent Confidence Layer
   - Executes Bloom detection (gated by confidence)
   - Performs competency mapping (gated by confidence)
   - Retrieves RAG context (gated by confidence, course-scoped)
   - Builds pedagogy-aware prompt
   - **Streams LLM tokens** using `llm_client.generate_stream()`
   - Stores assistant message in database
   - Summarizes conversation memory
   - Logs all pipeline stages

2. **`/ai-query/stream` endpoint**: POST endpoint that returns SSE stream
   - Accepts `QueryRequest` (query + session_id)
   - Requires authentication
   - Returns `EventSourceResponse` with SSE events

**SSE Event Types:**
- `status`: Pipeline started
- `token`: Individual token with partial_text and token_count
- `metadata`: Periodic stats (every 10 tokens) with tokens_per_second
- `done`: Final response with full_response, citations, bloom_level, course_id, message_id
- `error`: Error with partial_response if available

**Preserved:**
- Original `/ai-query` POST endpoint (non-streaming, backward compatible)
- Original `/ai-query` GET endpoint (browser-friendly, non-streaming)

---

## Frontend Changes

### `/frontend/react-app/src/hooks/useLLMStream.ts`

**Updated:**
- Changed `startStream()` signature: `(prompt: string, sessionId: string) => Promise<void>`
- Updated endpoint: `${API_BASE_URL}/ai-query/ai-query/stream`
- Updated payload: `{ query: prompt, session_id: sessionId }`
- Maintained SSE parsing logic for all event types

### `/frontend/react-app/src/modules/student/StudentWorkspace.tsx`

**Fixed streaming UI issues:**
1. **Index calculation bug**: Set `streamingMessageIndex` BEFORE adding placeholder message
2. **Two-bubble issue**: Removed "Streaming..." badge, show only bouncing dots when no content
3. **Session handling**: 
   - First message: Use `queryAtomic()` to create session (non-streaming fallback)
   - Subsequent messages: Use streaming with existing `session_id`

**Streaming flow:**
```
User sends first message
  → queryAtomic() creates session + returns response (non-streaming)
  → Session ID stored
  
User sends subsequent messages
  → startStream(message, sessionId) streams response
  → Full AI pipeline executed with streaming
```

---

## Why This Approach?

### First Message Non-Streaming
- Backend requires `session_id` for streaming endpoint
- No "create session" API exists separately
- `queryAtomic()` atomically creates session + stores messages + returns response
- Acceptable UX: first message slightly slower, all subsequent messages stream

### Streaming Integration Benefits
- ✅ Full pipeline execution (Bloom, CBC, RAG, confidence, memory)
- ✅ Course-scoped context retrieval
- ✅ Pedagogy-aware responses
- ✅ Complete logging and tracing
- ✅ Database persistence
- ✅ Citation support
- ✅ Backward compatible (non-streaming endpoints preserved)

---

## Testing

### Backend Test
```bash
curl -N -X POST http://localhost:8000/ai-query/ai-query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "Explain photosynthesis", "session_id": "existing-session-uuid"}'
```

### Frontend Test
1. Start new chat (first message uses queryAtomic, non-streaming)
2. Send second message (should stream with blue background, bouncing dots → text)
3. Verify citations appear after streaming completes
4. Check browser console for SSE events

---

## Files Modified

**Backend:**
- `/backend/app/routes/ai_query.py` - Added streaming pipeline function and endpoint

**Frontend:**
- `/frontend/react-app/src/hooks/useLLMStream.ts` - Updated endpoint and payload
- `/frontend/react-app/src/modules/student/StudentWorkspace.tsx` - Fixed UI bugs, added session handling

**Deprecated:**
- `/backend/app/routes/streaming.py` - Standalone streaming (bypasses pipeline, should be removed or repurposed)

---

## Next Steps

1. **Remove `/backend/app/routes/streaming.py`** - No longer needed, bypasses pipeline
2. **Test with real course data** - Verify RAG retrieval works during streaming
3. **Add streaming to LecturerAssistantPanel** - Apply same pattern
4. **Monitor performance** - Check if streaming adds latency to pipeline stages
5. **Consider first-message streaming** - Explore creating session via separate API call

---

## Architecture Diagram

```
User Query
    ↓
[Frontend: StudentWorkspace]
    ↓
First message? 
    YES → chatApi.queryAtomic() → Session created (non-streaming)
    NO  → useLLMStream.startStream(query, sessionId)
              ↓
         [Backend: /ai-query/stream]
              ↓
         run_ai_pipeline_streaming()
              ↓
    ┌─────────────────────────────┐
    │ 1. Validate session         │
    │ 2. Store user message       │
    │ 3. Confidence layer         │
    │ 4. Bloom detection (gated)  │
    │ 5. Competency mapping (gated)│
    │ 6. RAG retrieval (gated)    │
    │ 7. Build prompt             │
    │ 8. Stream LLM tokens ←──────│ SSE events
    │ 9. Store assistant message  │
    │ 10. Summarize memory        │
    └─────────────────────────────┘
              ↓
    [Frontend: Display streaming text]
```

---

## Summary

Streaming now runs through the **full AI query pipeline**, ensuring all responses are:
- Curriculum-aligned
- Pedagogy-aware  
- Context-enriched
- Properly logged
- Database-persisted

The first message uses non-streaming `queryAtomic()` to create the session, then all subsequent messages stream through the complete pipeline.
