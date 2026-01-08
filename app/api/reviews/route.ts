import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { ReviewRequest, ReviewStatus } from '@/types/collaboration';

export const dynamic = 'force-dynamic';

// Auto-initialize review_requests table
async function ensureTableExists() {
  await sql`
    CREATE TABLE IF NOT EXISTS review_requests (
      id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      step INTEGER,
      requester_id VARCHAR(255) NOT NULL,
      requester_name VARCHAR(255),
      requester_image TEXT,
      reviewer_id VARCHAR(255) NOT NULL,
      reviewer_name VARCHAR(255),
      reviewer_image TEXT,
      note TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      response_note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      responded_at TIMESTAMP WITH TIME ZONE
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_review_session ON review_requests (session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_review_reviewer ON review_requests (reviewer_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_review_requester ON review_requests (requester_id, status)`;
}

// Helper to get current user
async function getCurrentUser(email: string) {
  const result = await sql`
    SELECT id, email, name, image FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;
  return result.rows[0] || null;
}

// GET /api/reviews - Get all reviews for the current user
export async function GET(request: Request) {
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
    const filter = searchParams.get('filter') || 'pending'; // 'pending', 'completed', 'all', 'requested'

    let reviewsResult;

    try {
      if (filter === 'requested') {
        // Reviews this user has requested from others
        reviewsResult = await sql`
          SELECT r.*, s.data as session_data
          FROM review_requests r
          LEFT JOIN sessions s ON r.session_id = s.id
          WHERE r.requester_id = ${user.id}
          ORDER BY r.created_at DESC
          LIMIT 100
        `;
      } else if (filter === 'all') {
        // All reviews where user is reviewer
        reviewsResult = await sql`
          SELECT r.*, s.data as session_data
          FROM review_requests r
          LEFT JOIN sessions s ON r.session_id = s.id
          WHERE r.reviewer_id = ${user.id}
          ORDER BY r.created_at DESC
          LIMIT 100
        `;
      } else if (filter === 'completed') {
        // Completed reviews where user is reviewer
        reviewsResult = await sql`
          SELECT r.*, s.data as session_data
          FROM review_requests r
          LEFT JOIN sessions s ON r.session_id = s.id
          WHERE r.reviewer_id = ${user.id}
            AND r.status IN ('approved', 'changes_requested')
          ORDER BY r.responded_at DESC
          LIMIT 100
        `;
      } else {
        // Pending reviews where user is reviewer (default)
        reviewsResult = await sql`
          SELECT r.*, s.data as session_data
          FROM review_requests r
          LEFT JOIN sessions s ON r.session_id = s.id
          WHERE r.reviewer_id = ${user.id}
            AND r.status = 'pending'
          ORDER BY r.created_at DESC
          LIMIT 100
        `;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        await ensureTableExists();
        return Response.json({ reviews: [], counts: { pending: 0, completed: 0, requested: 0 } });
      }
      throw error;
    }

    const reviews: (ReviewRequest & { sessionTitle?: string })[] = reviewsResult.rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      step: row.step,
      requesterId: row.requester_id,
      requesterName: row.requester_name,
      requesterImage: row.requester_image,
      reviewerId: row.reviewer_id,
      reviewerName: row.reviewer_name,
      reviewerImage: row.reviewer_image,
      note: row.note,
      status: row.status as ReviewStatus,
      responseNote: row.response_note,
      createdAt: row.created_at,
      respondedAt: row.responded_at,
      sessionTitle: row.session_data?.topic?.title || row.session_data?.topic?.slug || 'Untitled',
    }));

    // Get counts
    const countsResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE reviewer_id = ${user.id} AND status = 'pending') as pending,
        COUNT(*) FILTER (WHERE reviewer_id = ${user.id} AND status IN ('approved', 'changes_requested')) as completed,
        COUNT(*) FILTER (WHERE requester_id = ${user.id}) as requested
      FROM review_requests
    `;

    const counts = {
      pending: parseInt(countsResult.rows[0]?.pending || '0'),
      completed: parseInt(countsResult.rows[0]?.completed || '0'),
      requested: parseInt(countsResult.rows[0]?.requested || '0'),
    };

    return Response.json({ reviews, counts });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return Response.json({
      error: 'Failed to fetch reviews',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
