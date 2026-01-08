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
}

// Helper to get current user
async function getCurrentUser(email: string) {
  const result = await sql`
    SELECT id, email, name, image FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;
  return result.rows[0] || null;
}

// Helper to get user by ID
async function getUserById(userId: string) {
  const result = await sql`
    SELECT id, email, name, image FROM users WHERE id = ${userId} LIMIT 1
  `;
  return result.rows[0] || null;
}

// GET /api/sessions/[id]/review - Get review requests for a session
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = (await params).id;

    const result = await sql`
      SELECT *
      FROM review_requests
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
    `;

    const reviews: ReviewRequest[] = result.rows.map(row => ({
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
    }));

    return Response.json({ reviews });
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      try {
        await ensureTableExists();
        return Response.json({ reviews: [] });
      } catch (initError) {
        console.error('Error initializing review_requests table:', initError);
      }
    }

    console.error('Error fetching reviews:', error);
    return Response.json({
      error: 'Failed to fetch reviews',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/sessions/[id]/review - Request a review
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const requester = await getCurrentUser(session.user.email);
    if (!requester) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const sessionId = (await params).id;
    const { reviewerId, step, note } = await request.json();

    if (!reviewerId) {
      return Response.json({ error: 'Reviewer ID is required' }, { status: 400 });
    }

    const reviewer = await getUserById(reviewerId);
    if (!reviewer) {
      return Response.json({ error: 'Reviewer not found' }, { status: 404 });
    }

    // Ensure table exists before any operations
    await ensureTableExists();

    // Cancel any existing pending reviews for this session/step
    try {
      await sql`
        UPDATE review_requests
        SET status = 'cancelled'
        WHERE session_id = ${sessionId}
          AND (step = ${step || null} OR (step IS NULL AND ${step || null} IS NULL))
          AND status = 'pending'
      `;
    } catch (e) {
      // Table might not exist yet, ignore
      console.log('Update existing reviews error (non-fatal):', e);
    }

    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await sql`
      INSERT INTO review_requests (
        id, session_id, step,
        requester_id, requester_name, requester_image,
        reviewer_id, reviewer_name, reviewer_image,
        note, status
      )
      VALUES (
        ${reviewId},
        ${sessionId},
        ${step || null},
        ${requester.id},
        ${requester.name || requester.email},
        ${requester.image || null},
        ${reviewer.id},
        ${reviewer.name || reviewer.email},
        ${reviewer.image || null},
        ${note || null},
        'pending'
      )
    `;

    // Log activity
    const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      await sql`
        INSERT INTO activity_log (id, session_id, user_id, user_name, user_image, type, step, metadata)
        VALUES (
          ${activityId},
          ${sessionId},
          ${requester.id},
          ${requester.name || requester.email},
          ${requester.image || null},
          'review_requested',
          ${step || null},
          ${JSON.stringify({ reviewerId: reviewer.id, reviewerName: reviewer.name || reviewer.email, note })}
        )
      `;
    } catch {
      // Activity logging failure shouldn't fail the review request
    }

    // Update session status to 'review'
    try {
      await sql`
        UPDATE sessions
        SET data = jsonb_set(data, '{workflowStatus}', '"review"'),
            updated_at = NOW()
        WHERE id = ${sessionId}
      `;
    } catch {
      // Status update failure shouldn't fail the review request
    }

    const review: ReviewRequest = {
      id: reviewId,
      sessionId,
      step,
      requesterId: requester.id,
      requesterName: requester.name || requester.email,
      requesterImage: requester.image,
      reviewerId: reviewer.id,
      reviewerName: reviewer.name || reviewer.email,
      reviewerImage: reviewer.image,
      note,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    return Response.json({ success: true, review });
  } catch (error) {
    console.error('Error creating review request:', error);
    return Response.json({
      error: 'Failed to create review request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/sessions/[id]/review - Respond to a review
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const sessionId = (await params).id;
    const { reviewId, status, responseNote } = await request.json();

    if (!reviewId || !status) {
      return Response.json({ error: 'reviewId and status are required' }, { status: 400 });
    }

    if (!['approved', 'changes_requested'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Verify this user is the reviewer
    const existing = await sql`
      SELECT * FROM review_requests WHERE id = ${reviewId} AND reviewer_id = ${user.id}
    `;

    if (existing.rows.length === 0) {
      return Response.json({ error: 'Review not found or not authorized' }, { status: 404 });
    }

    await sql`
      UPDATE review_requests
      SET status = ${status},
          response_note = ${responseNote || null},
          responded_at = NOW()
      WHERE id = ${reviewId}
    `;

    // Log activity
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
          'review_completed',
          ${existing.rows[0].step},
          ${JSON.stringify({ status, responseNote })}
        )
      `;
    } catch {
      // Activity logging failure shouldn't fail the response
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error responding to review:', error);
    return Response.json({
      error: 'Failed to respond to review',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
