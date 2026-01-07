export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const REGENERATE_POST_PROMPT = `You are a LinkedIn content expert. Regenerate this LinkedIn post based on the user's feedback.

ORIGINAL POST:
{originalPost}

USER FEEDBACK:
{feedback}

ARTICLE CONTEXT:
Title: {title}
URL: withbanner.com/info/{slug}

Instructions:
- Keep the same general topic but incorporate the user's feedback
- Maintain professional LinkedIn tone
- Keep it under 3000 characters
- Include a compelling hook in the first line
- End with a call-to-action or thought-provoking question

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "content": "The regenerated post content here",
  "hook_line": "The first compelling line",
  "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3"]
}`;

export async function POST(request: Request) {
  try {
    const { originalPost, feedback, title, slug, postType } = await request.json();

    if (!originalPost || !feedback) {
      return new Response(JSON.stringify({ error: 'Original post and feedback are required' }), {
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

    const prompt = REGENERATE_POST_PROMPT
      .replace('{originalPost}', originalPost)
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
        max_tokens: 1500,
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
        error: 'Failed to regenerate post',
        details: `Claude API returned status ${response.status}`,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    // Parse JSON from response
    let postData;
    try {
      postData = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        postData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }

    return new Response(JSON.stringify({
      content: postData.content,
      hook_line: postData.hook_line,
      hashtags: postData.hashtags || [],
      type: postType,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error regenerating post:', error);
    return new Response(JSON.stringify({
      error: 'Failed to regenerate post',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
