export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const REGENERATE_CAROUSEL_PROMPT = `You are a LinkedIn carousel content expert. Regenerate the carousel slides based on the user's feedback.

CURRENT CAROUSEL:
Hook: {hook}
Slides:
{slides}

USER FEEDBACK:
{feedback}

ARTICLE CONTEXT:
Title: {title}

Instructions:
- Create a compelling carousel that tells a story
- Each slide should have a clear headline (max 8 words) and optional subhead (max 15 words)
- The hook should grab attention immediately
- Structure for maximum engagement: Hook → Problem → Solution → Benefits → CTA
- Keep slides scannable - one idea per slide
- Generate 5-7 content slides (not including hook and CTA)

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "hook": "The attention-grabbing hook text",
  "slides": [
    {"headline": "Slide 1 Headline", "subhead": "Optional supporting text"},
    {"headline": "Slide 2 Headline", "subhead": "Optional supporting text"}
  ],
  "cta_slide": {
    "headline": "Call to action headline",
    "url": "withbanner.com/info/{slug}"
  }
}`;

export async function POST(request: Request) {
  try {
    const { hook, slides, feedback, title, slug } = await request.json();

    if (!feedback) {
      return new Response(JSON.stringify({ error: 'Feedback is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'ANTHROPIC_API_KEY not configured',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const slidesText = slides?.map((s: { headline: string; subhead?: string }, i: number) =>
      `${i + 1}. ${s.headline}${s.subhead ? ` - ${s.subhead}` : ''}`
    ).join('\n') || 'No slides yet';

    const prompt = REGENERATE_CAROUSEL_PROMPT
      .replace('{hook}', hook || 'No hook yet')
      .replace('{slides}', slidesText)
      .replace('{feedback}', feedback)
      .replace('{title}', title || 'Untitled')
      .replace('{slug}', slug || '');

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
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return new Response(JSON.stringify({
        error: 'Failed to regenerate carousel',
        details: `Claude API returned status ${response.status}`,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    // Parse JSON from response
    let carouselData;
    try {
      carouselData = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        carouselData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }

    // Add IDs to slides
    const processedSlides = (carouselData.slides || []).map((slide: { headline: string; subhead?: string }, index: number) => ({
      id: `slide_${Date.now()}_${index}`,
      slideNumber: index + 1,
      type: 'content',
      headline: slide.headline,
      subhead: slide.subhead || '',
      isEdited: false,
    }));

    return new Response(JSON.stringify({
      hook: carouselData.hook,
      slides: processedSlides,
      cta_slide: carouselData.cta_slide || {
        headline: 'Read the Full Guide',
        url: `withbanner.com/info/${slug}`,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error regenerating carousel:', error);
    return new Response(JSON.stringify({
      error: 'Failed to regenerate carousel',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
