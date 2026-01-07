import { NextResponse } from 'next/server';
import { LINKEDIN_EXTRACTION_PROMPT } from '@/lib/constants/prompts';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { title, slug, content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Blog content is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const userPrompt = `ARTICLE TITLE: ${title}
ARTICLE SLUG: ${slug}

ARTICLE CONTENT:
${content}`;

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
            content: `${LINKEDIN_EXTRACTION_PROMPT}\n\n---\n\n${userPrompt}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return NextResponse.json({ error: 'Failed to generate LinkedIn content' }, { status: 500 });
    }

    const data = await response.json();
    const responseText = data.content[0].text;

    // Parse JSON from response
    let linkedinData;
    try {
      linkedinData = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        linkedinData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Failed to parse LinkedIn content response');
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

    return NextResponse.json({
      posts,
      carousel: {
        hook: carousel.hook || '',
        slides: carouselSlides,
        cta_slide: carousel.cta_slide || { headline: 'Read the Full Guide', url: `withbanner.com/info/${slug}` },
      },
      article_title: linkedinData.article_title,
      article_url: linkedinData.article_url,
    });
  } catch (error) {
    console.error('Error generating LinkedIn content:', error);
    return NextResponse.json(
      { error: 'Failed to generate LinkedIn content' },
      { status: 500 }
    );
  }
}
