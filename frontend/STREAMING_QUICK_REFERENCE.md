# EduScape AI Streaming - Quick Reference

## 🚀 Using the Streaming Hook

```typescript
import { useLLMStream } from '../../hooks/useLLMStream';

const { isStreaming, partialText, startStream, abortStream, metrics } = useLLMStream({
  token: authToken,
  onComplete: (fullText) => {
    // Handle completion
    console.log('Stream complete:', fullText);
  },
  onError: (error, partialText) => {
    // Handle error
    console.error('Stream error:', error);
  },
});

// Start streaming
await startStream('Your prompt here');

// Abort streaming
abortStream();
```

## 📦 Hook Return Values

| Property | Type | Description |
|----------|------|-------------|
| `isStreaming` | `boolean` | True while stream is active |
| `partialText` | `string` | Accumulated tokens so far |
| `error` | `string \| null` | Error message if stream failed |
| `metrics` | `StreamMetrics \| null` | Token count, speed, elapsed time |
| `startStream` | `function` | Start streaming with prompt |
| `abortStream` | `function` | Cancel active stream |

## 🎨 UI Pattern

```typescript
// 1. Track streaming message index
const [streamingMessageIndex, setStreamingMessageIndex] = useState<number | null>(null);

// 2. Add placeholder before streaming
const placeholder = { role: "assistant", content: "", timestamp: new Date().toISOString() };
setMessages(prev => [...prev, placeholder]);
setStreamingMessageIndex(messages.length + 1);

// 3. Start stream
await startStream(userPrompt);

// 4. Render with streaming state
messages.map((msg, idx) => {
  const isStreamingMsg = idx === streamingMessageIndex;
  const displayContent = isStreamingMsg ? partialText : msg.content;
  
  return (
    <div className={isStreamingMsg ? 'streaming-style' : 'normal-style'}>
      <MarkdownMessage content={displayContent} />
      {isStreamingMsg && <StreamingIndicator />}
    </div>
  );
})
```

## 🎯 Backend SSE Contract

### Request
```json
POST /api/v1/stream/chat
{
  "prompt": "Your question here",
  "request_id": "optional-uuid"
}
```

### Response Events

**Token Event** (every token):
```json
{
  "request_id": "...",
  "token": "word",
  "partial_text": "accumulated text so far",
  "token_count": 42
}
```

**Metadata Event** (every 10 tokens):
```json
{
  "request_id": "...",
  "token_count": 50,
  "elapsed_seconds": 2.5,
  "tokens_per_second": 20.0
}
```

**Done Event** (completion):
```json
{
  "request_id": "...",
  "full_response": "complete response text",
  "total_tokens": 150,
  "elapsed_seconds": 7.5,
  "tokens_per_second": 20.0
}
```

**Error Event** (on failure):
```json
{
  "request_id": "...",
  "error": "Error message",
  "token_count": 25,
  "partial_response": "text before error"
}
```

## 🔧 Common Patterns

### Prevent Double Submit
```typescript
if (!inputValue.trim() || isLoading || isStreaming) return;
```

### Stop Button
```tsx
{isStreaming && (
  <button onClick={abortStream}>Stop</button>
)}
```

### Disable Input During Stream
```tsx
<button disabled={isLoading || isStreaming || !inputValue.trim()}>
  Send
</button>
```

### Visual Streaming Indicator
```tsx
{isStreamingMsg && (
  <div className="flex items-center gap-2 text-blue-600">
    <div className="flex gap-1">
      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" 
           style={{ animationDelay: '0.1s' }} />
      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" 
           style={{ animationDelay: '0.2s' }} />
    </div>
    <span>Streaming...</span>
  </div>
)}
```

## 🐛 Debugging

### Check Stream in Browser Console
```javascript
const response = await fetch('http://localhost:8000/api/v1/stream/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({ prompt: 'Test', request_id: 'debug-1' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}
```

### Common Issues

**Stream not starting:**
- Check token is valid
- Verify endpoint URL is correct
- Check network tab for 401/403 errors

**Tokens not appearing:**
- Check `streamingMessageIndex` is set correctly
- Verify `partialText` is updating in React DevTools
- Check for console errors in SSE parsing

**UI freezing:**
- Verify `requestAnimationFrame` batching is working
- Check for excessive re-renders in React DevTools
- Ensure only streaming message updates, not entire array

**Memory leaks:**
- Verify `abortStream` is called in useEffect cleanup
- Check AbortController is properly cleaned up
- Ensure no lingering event listeners

## 📱 Mobile Considerations

- Streaming works on mobile browsers
- Stop button should be easily tappable (min 44x44px)
- Auto-scroll should respect user scroll position
- Consider reducing animation on low-end devices

## ⚡ Performance Tips

1. **Batch Updates**: Hook uses `requestAnimationFrame` automatically
2. **Minimal Re-Renders**: Only update streaming message, not entire chat
3. **Efficient Selectors**: Use index-based tracking, not array.find()
4. **CSS Transitions**: Use transform/opacity for smooth animations
5. **Lazy Loading**: MarkdownMessage handles incremental parsing

## 🔒 Security Notes

- Token is passed via Authorization header (not in URL)
- AbortController prevents request hanging
- Partial responses are sanitized by MarkdownMessage
- No eval() or innerHTML used in streaming logic

---

**Quick Start**: Import hook → Add placeholder → Start stream → Render with conditional styling
