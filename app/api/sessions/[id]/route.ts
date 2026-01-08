import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import type { PipelineSession } from '@/types/session';

export const dynamic = 'force-dynamic';

// Helper to get current user info (case-insensitive email match)
async function getCurrentUser(email: string) {
  const result = await sql`
    SELECT id, email, name, image FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;
  return result.rows[0] || null;
}

// Helper to check if user has access to a session
async function checkSessionAccess(sessionId: string, userId: string): Promise<{ hasAccess: boolean; session: any | null }> {
  const { rows } = await sql`
    SELECT s.id, s.data, s.team_id, s.created_by, s.created_at, s.updated_at
    FROM sessions s
    WHERE s.id = ${sessionId}
  `;

  if (rows.length === 0) {
    return { hasAccess: false, session: null };
  }

  const session = rows[0];

  // If session has no team, allow access (legacy sessions)
  if (!session.team_id) {
    return { hasAccess: true, session };
  }

  // Check if user is member of the session's team
  const membership = await sql`
    SELECT 1 FROM team_members WHERE team_id = ${session.team_id} AND user_id = ${userId} LIMIT 1
  `;

  return {
    hasAccess: membership.rows.length > 0,
    session,
  };
}

// GET /api/sessions/[id] - Get single session
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authSession = await getServerSession(authOptions);

    // Get session from database
    const { rows } = await sql`
      SELECT s.id, s.data, s.team_id, s.created_by, s.created_at, s.updated_at,
             u.email as creator_email, u.name as creator_name, u.image as creator_image,
             a.id as assignee_id, a.email as assignee_email, a.name as assignee_name, a.image as assignee_image
      FROM sessions s
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN users a ON (s.data->>'assignedTo') = a.id
      WHERE s.id = ${params.id}
    `;

    if (rows.length === 0) {
      return Response.json({
        error: 'Session not found',
        notFound: true
      }, { status: 404 });
    }

    const row = rows[0];

    // Authorization check: if session has a team, verify user is a member
    if (row.team_id) {
      if (!authSession?.user?.email) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
      }

      const user = await getCurrentUser(authSession.user.email);
      if (!user) {
        return Response.json({ error: 'User not found' }, { status: 403 });
      }

      const membership = await sql`
        SELECT 1 FROM team_members WHERE team_id = ${row.team_id} AND user_id = ${user.id} LIMIT 1
      `;

      if (membership.rows.length === 0) {
        return Response.json({ error: 'Not authorized to access this session' }, { status: 403 });
      }
    }

    const session = {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      teamId: row.team_id,
      createdBy: row.created_by,
      creator: row.creator_email ? {
        id: row.created_by,
        email: row.creator_email,
        name: row.creator_name,
        image: row.creator_image,
      } : undefined,
      assignee: row.assignee_email ? {
        id: row.assignee_id,
        email: row.assignee_email,
        name: row.assignee_name,
        image: row.assignee_image,
      } : undefined,
    };

    return Response.json({ session });
  } catch (error) {
    console.error('Error fetching session:', error);
    return Response.json({
      error: 'Failed to fetch session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/sessions/[id] - Update session
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authSession = await getServerSession(authOptions);
    const updates: Partial<PipelineSession> = await request.json();

    // Get existing session first
    const { rows: existing } = await sql`
      SELECT data, team_id, created_by FROM sessions WHERE id = ${params.id}
    `;

    if (existing.length === 0) {
      return Response.json({
        error: 'Session not found',
        notFound: true
      }, { status: 404 });
    }

    const existingSession = existing[0];

    // Authorization check: if session has a team, verify user is a member
    if (existingSession.team_id) {
      if (!authSession?.user?.email) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
      }

      const user = await getCurrentUser(authSession.user.email);
      if (!user) {
        return Response.json({ error: 'User not found' }, { status: 403 });
      }

      const membership = await sql`
        SELECT 1 FROM team_members WHERE team_id = ${existingSession.team_id} AND user_id = ${user.id} LIMIT 1
      `;

      if (membership.rows.length === 0) {
        return Response.json({ error: 'Not authorized to update this session' }, { status: 403 });
      }
    }

    // Merge updates with existing data
    const currentData = existingSession.data as PipelineSession;
    const updatedData = deepMerge(currentData, updates);

    // Preserve team context in the data
    updatedData.teamId = existingSession.team_id || undefined;
    updatedData.createdBy = existingSession.created_by || undefined;

    await sql`
      UPDATE sessions
      SET data = ${JSON.stringify(updatedData)}, updated_at = NOW()
      WHERE id = ${params.id}
    `;

    return Response.json({ session: updatedData });
  } catch (error) {
    console.error('Error updating session:', error);
    return Response.json({
      error: 'Failed to update session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/sessions/[id] - Delete session
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authSession = await getServerSession(authOptions);

    // Get session first to check authorization
    const { rows } = await sql`
      SELECT team_id, created_by FROM sessions WHERE id = ${params.id}
    `;

    if (rows.length === 0) {
      return Response.json({ success: true }); // Already deleted
    }

    const existingSession = rows[0];

    // Authorization check: if session has a team, verify user is a member
    if (existingSession.team_id) {
      if (!authSession?.user?.email) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
      }

      const user = await getCurrentUser(authSession.user.email);
      if (!user) {
        return Response.json({ error: 'User not found' }, { status: 403 });
      }

      const membership = await sql`
        SELECT 1 FROM team_members WHERE team_id = ${existingSession.team_id} AND user_id = ${user.id} LIMIT 1
      `;

      if (membership.rows.length === 0) {
        return Response.json({ error: 'Not authorized to delete this session' }, { status: 403 });
      }
    }

    await sql`DELETE FROM sessions WHERE id = ${params.id}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return Response.json({
      error: 'Failed to delete session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Deep merge helper function
function deepMerge(target: PipelineSession, source: Partial<PipelineSession>): PipelineSession {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const k = key as keyof PipelineSession;
      const sourceValue = source[k];
      const targetValue = target[k];

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)[k] = { ...targetValue, ...sourceValue };
      } else if (sourceValue !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)[k] = sourceValue;
      }
    }
  }

  return result;
}
