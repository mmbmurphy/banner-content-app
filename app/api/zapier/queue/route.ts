import { NextResponse } from 'next/server';

interface PostToQueue {
  content: string;
  type: string;
  hook_line: string;
  hashtags: string[];
  articleUrl: string;
}

export async function POST(request: Request) {
  try {
    const { posts } = await request.json() as { posts: PostToQueue[] };

    if (!posts || posts.length === 0) {
      return NextResponse.json({ error: 'No posts to queue' }, { status: 400 });
    }

    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;

    if (!webhookUrl) {
      // Return mock success for demo purposes
      console.log('Zapier queue (mock):', posts.length, 'posts');
      return NextResponse.json({
        success: true,
        queued: posts.length,
        message: 'Queue simulated (ZAPIER_WEBHOOK_URL not configured)',
      });
    }

    let successCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      const hashtags = (post.hashtags || []).slice(0, 3).join(' ');

      let fullContent = post.content;
      fullContent += '\n\n' + post.articleUrl;
      if (hashtags) fullContent += '\n\n' + hashtags;

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: fullContent,
            post_type: post.type,
            hook_line: post.hook_line || '',
          }),
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Failed to queue post: ${response.status}`);
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        errorCount++;
        console.error('Error queuing post:', error);
      }
    }

    return NextResponse.json({
      success: true,
      queued: successCount,
      failed: errorCount,
    });
  } catch (error) {
    console.error('Error queuing to Zapier:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Queue failed' },
      { status: 500 }
    );
  }
}
