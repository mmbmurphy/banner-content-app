import { NextResponse } from 'next/server';
import { BLOG_GENERATION_PROMPT } from '@/lib/constants/prompts';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { title, slug, outline } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'ANTHROPIC_API_KEY not configured',
        details: 'Please add ANTHROPIC_API_KEY to your environment variables in Vercel dashboard.'
      }, { status: 500 });
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

      return NextResponse.json({ error: errorMessage, details }, { status: 500 });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse frontmatter from the response
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (frontmatterMatch) {
      const frontmatterYaml = frontmatterMatch[1];
      const markdownContent = frontmatterMatch[2].trim();

      // Simple YAML parsing
      const frontmatter: Record<string, unknown> = {};
      frontmatterYaml.split('\n').forEach((line: string) => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          let value: unknown = line.slice(colonIndex + 1).trim();

          // Handle arrays
          if (value === '' || (typeof value === 'string' && value.startsWith('['))) {
            if (typeof value === 'string' && value.startsWith('[')) {
              try {
                value = JSON.parse(value);
              } catch {
                value = [];
              }
            }
          } else if (value === 'true') {
            value = true;
          } else if (value === 'false') {
            value = false;
          }

          frontmatter[key] = value;
        }
      });

      return NextResponse.json({
        frontmatter,
        content: markdownContent,
        raw: content,
      });
    }

    // If no frontmatter found, return raw content
    return NextResponse.json({
      frontmatter: { title, slug },
      content,
      raw: content,
    });
  } catch (error) {
    console.error('Error generating blog:', error);
    return NextResponse.json(
      { error: 'Failed to generate blog content' },
      { status: 500 }
    );
  }
}
