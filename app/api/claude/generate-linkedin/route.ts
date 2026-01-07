import { LINKEDIN_EXTRACTION_PROMPT } from '@/lib/constants/prompts';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { title, slug, content, customPrompt } = await request.json();

    if (!content) {
      return new Response(JSON.stringify({ error: 'Blog content is required' }), {
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

    let userPrompt = `ARTICLE TITLE: ${title}
ARTICLE SLUG: ${slug}

ARTICLE CONTENT:
${content}`;

    if (customPrompt) {
      userPrompt += `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${customPrompt}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        stream: true,
        messages: [
          {
            role: 'user',
            content: `${LINKEDIN_EXTRACTION_PROMPT}\n\n---\n\n${userPrompt}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      let errorMessage = 'Failed to generate LinkedIn content';
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

    // Stream and collect the response
    const decoder = new TextDecoder();
    const reader = response.body?.getReader();
    let fullContent = '';

    if (reader) {
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
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      }
    }

    // Parse JSON from response
    let linkedinData;
    try {
      linkedinData = JSON.parse(fullContent);
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = fullContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        linkedinData = JSON.parse(jsonMatch[1]);
      } else {
        return new Response(JSON.stringify({
          error: 'Failed to parse LinkedIn content',
          details: 'Claude did not return valid JSON. Try again.'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Add unique IDs to posts
    const posts = (linkedinData.posts || []).map((post: { type: string; content: string; hook_line: string; hashtags: string[] }, index: number) => ({
      id: `post_${Date.now()}_${index}`,
      type: post.type,
      content: post.content,
      hook_line: post.hook_line,
      hashtags: post.hashtags || [],
      isEdited: false,
    }));

    // Process carousel data
    const carousel = linkedinData.carousel || {};
    const carouselSlides = (carousel.slides || []).map((slide: { headline: string; subhead: string }, index: number) => ({
      id: `slide_${Date.now()}_${index}`,
      slideNumber: index + 1,
      type: index === 0 ? 'hook' : index === carousel.slides.length - 1 ? 'cta' : 'content',
      headline: slide.headline,
      subhead: slide.subhead,
      isEdited: false,
    }));

    return new Response(JSON.stringify({
      posts,
      carousel: {
        hook: carousel.hook || '',
        slides: carouselSlides,
        cta_slide: carousel.cta_slide || { headline: 'Read the Full Guide', url: `withbanner.com/info/${slug}` },
      },
      article_title: linkedinData.article_title,
      article_url: linkedinData.article_url,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating LinkedIn content:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate LinkedIn content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
