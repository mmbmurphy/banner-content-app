import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import type { Activity, ActivityType } from '@/types/collaboration';

export const dynamic = 'force-dynamic';

// Auto-initialize activity table
async function ensureTableExists() {
  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      user_name VARCHAR(255),
      user_image TEXT,
      type VARCHAR(50) NOT NULL,
      step INTEGER,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_session ON activity_log (session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log (created_at DESC)`;
}

// Helper to get current user
async function getCurrentUser(email: string) {
  const result = await sql`
    SELECT id, email, name, image FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;
  return result.rows[0] || null;
}

// GET /api/sessions/[id]/activity - Get activity feed for a session
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const result = await sql`
      SELECT id, session_id, user_id, user_name, user_image, type, step, metadata, created_at
      FROM activity_log
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const activities: Activity[] = result.rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      userName: row.user_name,
      userImage: row.user_image,
      type: row.type as ActivityType,
      step: row.step,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));

    return Response.json({ activities });
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      try {
        await ensureTableExists();
        return Response.json({ activities: [] });
      } catch (initError) {
        console.error('Error initializing activity table:', initError);
      }
    }

    console.error('Error fetching activity:', error);
    return Response.json({
      error: 'Failed to fetch activity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/sessions/[id]/activity - Log an activity
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
    const { type, step, metadata } = await request.json();

    if (!type) {
      return Response.json({ error: 'Activity type is required' }, { status: 400 });
    }

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
          ${type},
          ${step || null},
          ${metadata ? JSON.stringify(metadata) : null}
        )
      `;
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        await ensureTableExists();
        await sql`
          INSERT INTO activity_log (id, session_id, user_id, user_name, user_image, type, step, metadata)
          VALUES (
            ${activityId},
            ${sessionId},
            ${user.id},
            ${user.name || user.email},
            ${user.image || null},
            ${type},
            ${step || null},
            ${metadata ? JSON.stringify(metadata) : null}
          )
        `;
      } else {
        throw error;
      }
    }

    return Response.json({
      success: true,
      activity: {
        id: activityId,
        sessionId,
        userId: user.id,
        userName: user.name || user.email,
        userImage: user.image,
        type,
        step,
        metadata,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    return Response.json({
      error: 'Failed to log activity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
