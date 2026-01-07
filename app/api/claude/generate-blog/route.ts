import { BLOG_GENERATION_PROMPT } from '@/lib/constants/prompts';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { title, slug, outline } = await request.json();

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'ANTHROPIC_API_KEY not configured',
        details: 'Please add ANTHROPIC_API_KEY to your environment variables in Vercel dashboard.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const userPrompt = `Write a comprehensive blog article about: "${title}"

Slug to use: ${slug}
Today's date: ${today}
${outline ? `\nOutline/Notes from the user:\n${outline}` : ''}

Write the complete article with frontmatter in markdown format.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        stream: true,
        messages: [
          {
            role: 'user',
            content: `${BLOG_GENERATION_PROMPT}\n\n---\n\n${userPrompt}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      let errorMessage = 'Failed to generate blog content';
      let details = `Claude API returned status ${response.status}`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          details = errorJson.error.message;
        }
      } catch {
        details = errorText.substring(0, 200);
      }

      return new Response(JSON.stringify({ error: errorMessage, details }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    fullContent += parsed.delta.text;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
                  }
                } catch {
                  // Skip unparseable lines
                }
              }
            }
          }

          // Send final message with complete content
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, content: fullContent })}\n\n`));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error generating blog:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate blog content' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
