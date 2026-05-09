# Unified Streaming Pipeline Implementation - COMPLETE

## Status: Backend Complete ✅ | Frontend Hook Complete ✅ | Components PENDING ⏳

---

## What Was Implemented

### ✅ Step 2: Backend - Unified Streaming Pipeline (COMPLETE)

**File: `/backend/app/routes/ai_query.py`**

1. **Added `AIQueryStreamRequest` model**:
   - `message: str` - User message
   - `course_id: Optional[str]` - Course context
   - `topic_id: Optional[str]` - Topic context (future use)
   - `session_id: Optional[str]` - Existing session ID or None for new session
   - `attachments: Optional[list]` - File attachments (future use)

2. **Rewrote `run_ai_pipeline_streaming()` function**:
   - **Session Creation**: If `session_id` is None, creates new session and yields `session_created` event
   - **Full Pipeline**: Runs Bloom → CBC → RAG → Confidence → Memory → Streaming LLM
   - **SSE Events**:
     - `{session_id, session_title}` - New session created (only if session_id was None)
     - `{status, session_id, is_new_session}` - Pipeline started
     - `{token, partial_text}` - Each token
     - `{tokens_generated, tokens_per_second, partial_text}` - Metadata every 10 tokens
     - `{full_response, session_id, citations, confidence_score}` - Done
     - `{error, partial_response, session_id}` - Error

3. **Updated `/ai-query/stream` endpoint**:
   - Accepts `AIQueryStreamRequest`
   - Converts `session_id` string to UUID
   - Returns `EventSourceResponse` with proper headers
   - Handles both new and existing sessions

4. **Preserved backward compatibility**:
   - Original `/ai-query` POST endpoint unchanged
   - Original `/ai-query` GET endpoint unchanged
   - `run_ai_pipeline()` function unchanged

---

### ✅ Step 3: Frontend - useLLMStream Hook (COMPLETE)

**File: `/frontend/react-app/src/hooks/useLLMStream.ts`**

**Complete rewrite with unified streaming support:**

1. **New TypeScript Interfaces**:
   ```typescript
   interface StreamEventStatus { status, session_id, is_new_session }
   interface StreamEventSessionCreated { session_id, session_title }
   interface StreamEventToken { token, partial_text }
   interface StreamEventMetadata { tokens_generated, tokens_per_second, partial_text }
   interface StreamEventDone { full_response, session_id, citations, confidence_score }
   interface StreamEventError { error, partial_response, session_id }
   ```

2. **New `StartStreamParams` interface**:
   ```typescript
   {
     message: string;
     courseId?: string;
     topicId?: string;
     sessionId?: string | null;  // null for first message
     attachments?: any[];
     onSessionCreated?: (sessionId, title) => void;
     onDone?: (fullResponse, sessionId, citations) => void;
     onError?: (error, partialResponse) => void;
   }
   ```

3. **Hook returns**:
   ```typescript
   {
     isStreaming: boolean;
     partialText: string;
     error: string | null;
     metrics: StreamMetrics | null;
     sessionId: string | null;  // NEW: tracks current session
     startStream: (params: StartStreamParams) => Promise<void>;
     abortStream: () => void;
   }
   ```

4. **Features**:
   - Parses all SSE event types
   - Calls `onSessionCreated` when new session is created
   - Calls `onDone` with full response and citations
   - Calls `onError` with error and partial response
   - Maintains `requestAnimationFrame` batching for performance
   - Proper AbortController cleanup
   - Tracks `sessionId` in hook state

---

## What Needs To Be Done Next

### ⏳ Step 4: Update StudentWorkspace.tsx (CRITICAL)

**File: `/frontend/react-app/src/modules/student/StudentWorkspace.tsx`**

**Required Changes:**

1. **Add state**:
   ```typescript
   const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
   ```

2. **Update hook usage**:
   ```typescript
   const { isStreaming, partialText, sessionId, startStream, abortStream } = useLLMStream({
     token: authToken || '',
   });
   ```

3. **Completely rewrite `sendMessage` function**:
   - REMOVE all `queryAtomic()` calls
   - REMOVE if/else branching between first/subsequent messages
   - Every message uses streaming:
   ```typescript
   const sendMessage = async () => {
     if (isStreaming) return;
     
     const userMessage = { role: 'user', content: trimmedMessage, timestamp: Date.now() };
     const placeholderIndex = messages.length + 1;
     
     setMessages(prev => [...prev, userMessage, { role: 'assistant', content: '', timestamp: Date.now() }]);
     setStreamingMessageIndex(placeholderIndex);
     
     await startStream({
       message: trimmedMessage,
       courseId: courseCode,
       sessionId: activeSessionId,  // null for first message
       onSessionCreated: (newSessionId, title) => {
         setActiveSessionId(newSessionId);
         // Update chat history
       },
       onDone: (fullResponse, sessionId, citations) => {
         setMessages(prev => prev.map((msg, idx) =>
           idx === placeholderIndex
             ? { ...msg, content: fullResponse, citations }
             : msg
         ));
         setStreamingMessageIndex(null);
         setActiveSessionId(sessionId);
       },
       onError: (error, partialResponse) => {
         if (partialResponse) {
           setMessages(prev => prev.map((msg, idx) =>
             idx === placeholderIndex
               ? { ...msg, content: partialResponse, error: true }
               : msg
           ));
         } else {
           setMessages(prev => prev.filter((_, idx) => idx !== placeholderIndex));
         }
         setStreamingMessageIndex(null);
       },
     });
   };
   ```

4. **Update message rendering**:
   - If `isStreaming && !partialText`: show ONLY bouncing dots (no text, no badge)
   - If `isStreaming && partialText`: show `partialText` with blue left border
   - When `!isStreaming`: show normal message with citations

5. **Preserve ALL existing features**:
   - Demo mode (useLocalDemo) - keep local mock, no streaming
   - Public preview mode
   - Citations display
   - Course switching
   - File uploads
   - Chat history
   - All UI elements

---

### ⏳ Step 5: Update LecturerAssistantPanel.tsx

**File: `/frontend/react-app/src/components/lecturer/LecturerAssistantPanel.tsx`**

Apply same pattern as StudentWorkspace but simpler (no citations).

---

### ⏳ Step 6: Update api.ts

**File: `/frontend/react-app/src/services/api.ts`**

1. Check if `queryAtomic()` is used anywhere else
2. If not used, mark as deprecated or remove
3. Verify streaming endpoint URL is correct

---

### ⏳ Step 7: Edge Cases Verification

Test all scenarios:
- First message in new chat
- Second message with existing session
- Switching courses
- Page refresh
- Network drops mid-stream
- User clicks Stop
- Rapid double-click send
- Multiple messages in sequence
- Demo mode unchanged
- Public preview mode
- Citations appear
- File uploads
- Lecturer panel
- Component unmount during stream
- Backend logs confirm full pipeline

---

### ⏳ Step 8: Cleanup

- Remove `streaming.py` if no other consumers
- Remove or deprecate `queryAtomic()` from api.ts
- Update documentation
- Remove temporary comments

---

## Key Architecture Changes

### Before (Broken)
```
First message: queryAtomic() → session created (non-streaming)
Subsequent messages: startStream() → streaming with session_id
```

### After (Unified)
```
EVERY message: startStream() → full pipeline streaming
  - If session_id is null: backend creates session first
  - If session_id exists: backend uses existing session
  - All messages stream through Bloom → CBC → RAG → LLM
```

---

## SSE Event Flow

```
Client sends: { message, course_id, session_id: null }
    ↓
Backend: Creates session
    ↓
SSE: data: {"session_id": "uuid", "session_title": "..."}
    ↓
SSE: data: {"status": "started", "session_id": "uuid", "is_new_session": true}
    ↓
Backend: Runs Bloom → CBC → RAG → Prompt
    ↓
Backend: Streams LLM tokens
    ↓
SSE: data: {"token": "The", "partial_text": "The"}
SSE: data: {"token": " answer", "partial_text": "The answer"}
SSE: data: {"tokens_generated": 10, "tokens_per_second": 5.2, "partial_text": "..."}
    ↓
Backend: Stores message, summarizes memory
    ↓
SSE: data: {"full_response": "...", "session_id": "uuid", "citations": [...]}
    ↓
Client: Updates UI with final message
```

---

## Critical Implementation Notes

1. **Index Calculation**: Calculate `placeholderIndex` BEFORE `setMessages` to avoid off-by-one errors
2. **Demo Mode**: Keep `useLocalDemo` unchanged - no backend calls, local mock only
3. **Public Preview**: Uses `demoToken` with backend, streaming works
4. **Session Tracking**: `activeSessionId` state tracks current session across messages
5. **Error Handling**: Partial responses preserved in UI, full errors remove placeholder
6. **Abort**: `abortStream()` cancels fetch, keeps partial text visible
7. **Citations**: Passed in `done` event, displayed after streaming completes

---

## Files Modified

### Backend
- ✅ `/backend/app/routes/ai_query.py` - Added unified streaming pipeline

### Frontend
- ✅ `/frontend/react-app/src/hooks/useLLMStream.ts` - Complete rewrite
- ⏳ `/frontend/react-app/src/modules/student/StudentWorkspace.tsx` - PENDING
- ⏳ `/frontend/react-app/src/components/lecturer/LecturerAssistantPanel.tsx` - PENDING
- ⏳ `/frontend/react-app/src/services/api.ts` - PENDING cleanup

### Documentation
- ✅ This file - Implementation summary

---

## Next Steps for Developer

1. **Implement StudentWorkspace.tsx changes** (most critical)
   - Follow the exact pattern in Step 4 above
   - Test thoroughly with first message, subsequent messages, course switching
   - Verify demo mode still works
   - Verify public preview still works

2. **Implement LecturerAssistantPanel.tsx changes**
   - Same pattern as StudentWorkspace but simpler

3. **Clean up api.ts**
   - Check `queryAtomic()` usage
   - Remove if unused

4. **Test all edge cases** (Step 7 checklist)

5. **Clean up** (Step 8)

---

## Testing Checklist

- [ ] First message creates session and streams
- [ ] Second message uses existing session and streams
- [ ] Course switching creates new session
- [ ] Stop button aborts stream, keeps partial text
- [ ] Network drop shows error, keeps partial text
- [ ] Demo mode works without backend
- [ ] Public preview streams with demo token
- [ ] Citations appear after streaming
- [ ] File uploads work
- [ ] Lecturer panel streams independently
- [ ] Component unmount cleans up
- [ ] Backend logs show full pipeline execution
- [ ] No console errors
- [ ] No memory leaks

---

## Success Criteria

✅ Every message (including first) streams through full AI pipeline
✅ Session creation happens seamlessly during first message stream
✅ No separate "queryAtomic" path - unified streaming only
✅ All existing features preserved (demo, preview, citations, uploads, etc.)
✅ Clean error handling with partial text preservation
✅ Smooth UI with bouncing dots → streaming text → final message
✅ Backend logs confirm Bloom, CBC, RAG, confidence all execute
✅ No breaking changes to existing functionality

---

## Implementation Complete: 40%

- Backend: 100% ✅
- Frontend Hook: 100% ✅
- Frontend Components: 0% ⏳
- Testing: 0% ⏳
- Cleanup: 0% ⏳

**Estimated remaining work: 4-6 hours for experienced developer**
