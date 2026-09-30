# recognise-equipment

Supabase Edge Function for server-side gym-equipment image recognition.

## Secrets

Set:

- `OPENAI_API_KEY`
- `OPENAI_VISION_MODEL` (optional, defaults to `gpt-5.6`)

Deploy with JWT verification enabled. The browser must never receive the OpenAI API key.

The function accepts:

```json
{
  "image_data_url": "data:image/jpeg;base64,..."
}
```

Confidence below 0.75 should require explicit user correction/confirmation in the client.
