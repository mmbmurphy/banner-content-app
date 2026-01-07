import { NextResponse } from 'next/server';
import { BRAND, WEBFLOW } from '@/lib/constants/brand';
import { marked } from 'marked';

const API_BASE = 'https://api.webflow.com/v2';

async function webflowRequest(endpoint: string, options: RequestInit = {}) {
  const apiToken = process.env.WEBFLOW_API_TOKEN;
  if (!apiToken) {
    throw new Error('WEBFLOW_API_TOKEN not configured');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Webflow API error (${response.status}): ${error}`);
  }

  return response.json();
}

async function getTopics() {
  const result = await webflowRequest(`/collections/${WEBFLOW.TOPICS_COLLECTION_ID}/items`);
  return result.items || [];
}

async function getExistingPosts() {
  const result = await webflowRequest(`/collections/${WEBFLOW.COLLECTION_ID}/items?limit=100`);
  return result.items || [];
}

function calculateReadTime(content: string) {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

export async function POST(request: Request) {
  try {
    const { frontmatter, content, existingItemId } = await request.json();

    if (!frontmatter?.title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Convert markdown to HTML
    const htmlContent = marked(content);
    const readTime = calculateReadTime(content);

    // Get topics and existing posts
    const [topics, existingPosts] = await Promise.all([
      getTopics(),
      getExistingPosts(),
    ]);

    // Find matching topic
    const topicName = frontmatter.topic || 'CapEx Management';
    const matchedTopic = topics.find(
      (t: { fieldData: { name: string } }) =>
        t.fieldData.name.toLowerCase() === topicName.toLowerCase()
    );

    // Check if post already exists by slug
    const slug = frontmatter.slug;
    const existingPost = existingPosts.find(
      (p: { fieldData: { slug: string } }) => p.fieldData.slug === slug
    );

    const postData = {
      fieldData: {
        name: frontmatter.title,
        slug: slug,
        'post-body': htmlContent,
        'post-summary': frontmatter.description || '',
        author: BRAND.DEFAULT_AUTHOR,
        'author-image': BRAND.DEFAULT_AUTHOR_IMAGE,
        'read-time': `${readTime} min read`,
        'title-tag': frontmatter.titleTag || frontmatter.title,
        ...(matchedTopic ? { topic: matchedTopic.id } : {}),
      },
    };

    let result;
    let action: 'created' | 'updated';

    if (existingItemId || existingPost) {
      // Update existing post
      const itemId = existingItemId || existingPost.id;
      result = await webflowRequest(
        `/collections/${WEBFLOW.COLLECTION_ID}/items/${itemId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(postData),
        }
      );
      action = 'updated';
    } else {
      // Create new post
      result = await webflowRequest(
        `/collections/${WEBFLOW.COLLECTION_ID}/items`,
        {
          method: 'POST',
          body: JSON.stringify(postData),
        }
      );
      action = 'created';
    }

    // Publish the item
    const itemId = result.id;
    await webflowRequest(
      `/collections/${WEBFLOW.COLLECTION_ID}/items/publish`,
      {
        method: 'POST',
        body: JSON.stringify({ itemIds: [itemId] }),
      }
    );

    const publishedUrl = `${BRAND.SITE_URL}/info/${slug}`;

    return NextResponse.json({
      success: true,
      action,
      itemId,
      publishedUrl,
      readTime,
    });
  } catch (error) {
    console.error('Error publishing to Webflow:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish' },
      { status: 500 }
    );
  }
}
