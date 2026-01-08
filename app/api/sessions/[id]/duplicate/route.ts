import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';

export const dynamic = 'force-dynamic';

// Helper to get current user info (case-insensitive email match)
async function getCurrentUser(email: string) {
  const result = await sql`
    SELECT id, email, name, image FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;
  return result.rows[0] || null;
}

// Helper to get user's current team
async function getUserTeam(userId: string) {
  const result = await sql`
    SELECT t.id, t.name, t.slug
    FROM teams t
    INNER JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = ${userId}
    ORDER BY t.created_at ASC
    LIMIT 1
  `;
  return result.rows[0] || null;
}

// POST /api/sessions/[id]/duplicate - Duplicate a session
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authSession = await getServerSession();

    // Get the original session with team info
    const { rows } = await sql`
      SELECT data, team_id, created_by FROM sessions WHERE id = ${params.id}
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const originalData = rows[0].data;
    const originalTeamId = rows[0].team_id;

    // Authorization check: if original session has a team, verify user is a member
    let userId: string | null = null;
    let newTeamId: string | null = originalTeamId;
    let creator = undefined;

    if (authSession?.user?.email) {
      const user = await getCurrentUser(authSession.user.email);
      if (user) {
        userId = user.id;
        creator = {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };

        // If original had a team, verify user is in it
        if (originalTeamId) {
          const membership = await sql`
            SELECT 1 FROM team_members
            WHERE team_id = ${originalTeamId} AND user_id = ${user.id}
            LIMIT 1
          `;
          if (membership.rows.length === 0) {
            return Response.json({ error: 'Not authorized to duplicate this session' }, { status: 403 });
          }
        } else {
          // Original had no team, assign to user's team
          const userTeam = await getUserTeam(user.id);
          newTeamId = userTeam?.id || null;
        }
      }
    } else if (originalTeamId) {
      // Session has a team but user not authenticated
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create duplicate with new ID, PRESERVING team context
    const duplicateData = {
      ...originalData,
      id: newId,
      createdAt: new Date().toISOString(),
      teamId: newTeamId || undefined,
      createdBy: userId || undefined,
      creator,
      // Reset progress - keep content but mark as in progress
      currentStep: 1,
      status: 'in_progress',
      workflowStatus: 'backlog',
      // Keep topic and content
      topic: {
        ...originalData.topic,
        title: `${originalData.topic?.title || 'Untitled'} (Copy)`,
      },
      // Keep blog content but reset publish status
      blog: {
        ...originalData.blog,
        webflowId: undefined,
        publishedUrl: undefined,
        status: 'draft',
      },
      // Keep carousel content but reset generated images
      carousel: {
        ...originalData.carousel,
        imageUrls: [],
        status: 'pending',
      },
      // Reset PDF
      pdf: {
        status: 'pending',
      },
      // Reset exports
      export: {
        sheetsExported: false,
        driveUploaded: false,
      },
      // Reset queue
      queue: {
        postsQueued: [],
        status: 'pending',
      },
    };

    // Insert with team_id and created_by columns
    await sql`
      INSERT INTO sessions (id, data, team_id, created_by, created_at, updated_at)
      VALUES (${newId}, ${JSON.stringify(duplicateData)}, ${newTeamId}, ${userId}, NOW(), NOW())
    `;

    return Response.json({
      success: true,
      session: duplicateData,
      newId,
    });
  } catch (error) {
    console.error('Error duplicating session:', error);
    return Response.json({
      error: 'Failed to duplicate session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
