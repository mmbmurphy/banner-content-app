import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import type { Comment } from '@/types/collaboration';

export const dynamic = 'force-dynamic';

// Auto-initialize comments table
async function ensureTableExists() {
  await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      step INTEGER,
      user_id VARCHAR(255) NOT NULL,
      user_name VARCHAR(255),
      user_image TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_session ON comments (session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_step ON comments (session_id, step)`;
}

// Helper to get current user
async function getCurrentUser(email: string) {
  const result = await sql`
    SELECT id, email, name, image FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;
  return result.rows[0] || null;
}

// GET /api/sessions/[id]/comments - Get comments for a session
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const { searchParams } = new URL(request.url);
    const step = searchParams.get('step');

    let result;
    if (step) {
      // Get comments for specific step
      result = await sql`
        SELECT id, session_id, step, user_id, user_name, user_image, content, created_at, updated_at
        FROM comments
        WHERE session_id = ${sessionId} AND step = ${parseInt(step)}
        ORDER BY created_at ASC
      `;
    } else {
      // Get all comments for session
      result = await sql`
        SELECT id, session_id, step, user_id, user_name, user_image, content, created_at, updated_at
        FROM comments
        WHERE session_id = ${sessionId}
        ORDER BY created_at ASC
      `;
    }

    const comments: Comment[] = result.rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      step: row.step,
      userId: row.user_id,
      userName: row.user_name,
      userImage: row.user_image,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return Response.json({ comments });
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      try {
        await ensureTableExists();
        return Response.json({ comments: [] });
      } catch (initError) {
        console.error('Error initializing comments table:', initError);
      }
    }

    console.error('Error fetching comments:', error);
    return Response.json({
      error: 'Failed to fetch comments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/sessions/[id]/comments - Add a comment
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await getCurrentUser(session.user.email);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const sessionId = params.id;
    const { step, content } = await request.json();

    if (!content || content.trim().length === 0) {
      return Response.json({ error: 'Comment content is required' }, { status: 400 });
    }

    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await sql`
        INSERT INTO comments (id, session_id, step, user_id, user_name, user_image, content)
        VALUES (
          ${commentId},
          ${sessionId},
          ${step || null},
          ${user.id},
          ${user.name || user.email},
          ${user.image || null},
          ${content.trim()}
        )
      `;
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        await ensureTableExists();
        await sql`
          INSERT INTO comments (id, session_id, step, user_id, user_name, user_image, content)
          VALUES (
            ${commentId},
            ${sessionId},
            ${step || null},
            ${user.id},
            ${user.name || user.email},
            ${user.image || null},
            ${content.trim()}
          )
        `;
      } else {
        throw error;
      }
    }

    // Also log this as an activity
    const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      await sql`
        INSERT INTO activity_log (id, session_id, user_id, user_name, user_image, type, step, metadata)
        VALUES (
          ${activityId},
          ${sessionId},
          ${user.id},
          ${user.name || user.email},
          ${user.image || null},
          'comment_added',
          ${step || null},
          ${JSON.stringify({ commentId, preview: content.trim().substring(0, 100) })}
        )
      `;
    } catch {
      // Activity logging failure shouldn't fail the comment
    }

    const comment: Comment = {
      id: commentId,
      sessionId,
      step,
      userId: user.id,
      userName: user.name || user.email,
      userImage: user.image,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    return Response.json({ success: true, comment });
  } catch (error) {
    console.error('Error adding comment:', error);
    return Response.json({
      error: 'Failed to add comment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/sessions/[id]/comments?commentId=xxx - Delete a comment
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await getCurrentUser(session.user.email);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return Response.json({ error: 'commentId is required' }, { status: 400 });
    }

    // Only allow deleting own comments
    const result = await sql`
      DELETE FROM comments
      WHERE id = ${commentId} AND user_id = ${user.id}
      RETURNING id
    `;

    if (result.rows.length === 0) {
      return Response.json({ error: 'Comment not found or not authorized' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return Response.json({
      error: 'Failed to delete comment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
