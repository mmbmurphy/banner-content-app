import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import type { PipelineSession } from '@/types/session';

export const dynamic = 'force-dynamic';

// Auto-initialize sessions table if it doesn't exist
async function ensureTableExists() {
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(255) PRIMARY KEY,
      data JSONB NOT NULL,
      team_id VARCHAR(255),
      created_by VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_team ON sessions (team_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_creator ON sessions (created_by)`;
}

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

// GET /api/sessions - List sessions for user's team
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    let rows: any[] = [];

    // If user is authenticated, filter by their team
    if (session?.user?.email) {
      const user = await getCurrentUser(session.user.email);

      if (user && teamId) {
        // Verify user is member of this team
        const membership = await sql`
          SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id} LIMIT 1
        `;

        if (membership.rows.length > 0) {
          const result = await sql`
            SELECT s.id, s.data, s.team_id, s.created_by, s.created_at, s.updated_at,
                   u.email as creator_email, u.name as creator_name, u.image as creator_image,
                   a.id as assignee_id, a.email as assignee_email, a.name as assignee_name, a.image as assignee_image
            FROM sessions s
            LEFT JOIN users u ON s.created_by = u.id
            LEFT JOIN users a ON (s.data->>'assignedTo') = a.id
            WHERE s.team_id = ${teamId}
            ORDER BY s.updated_at DESC
            LIMIT 100
          `;
          rows = result.rows;
        } else {
          rows = [];
        }
      } else if (user) {
        // Get user's default team
        const team = await getUserTeam(user.id);

        if (team) {
          // First, migrate any orphaned sessions from team members to this team
          await sql`
            UPDATE sessions s
            SET team_id = ${team.id}
            WHERE s.team_id IS NULL
              AND s.created_by IN (
                SELECT user_id FROM team_members WHERE team_id = ${team.id}
              )
          `;

          // Now fetch all team sessions (including newly migrated ones)
          const result = await sql`
            SELECT s.id, s.data, s.team_id, s.created_by, s.created_at, s.updated_at,
                   u.email as creator_email, u.name as creator_name, u.image as creator_image,
                   a.id as assignee_id, a.email as assignee_email, a.name as assignee_name, a.image as assignee_image
            FROM sessions s
            LEFT JOIN users u ON s.created_by = u.id
            LEFT JOIN users a ON (s.data->>'assignedTo') = a.id
            WHERE s.team_id = ${team.id}
            ORDER BY s.updated_at DESC
            LIMIT 100
          `;
          rows = result.rows;
        } else {
          // No team - show sessions created by this user or with no team
          const result = await sql`
            SELECT s.id, s.data, s.team_id, s.created_by, s.created_at, s.updated_at,
                   u.email as creator_email, u.name as creator_name, u.image as creator_image,
                   a.id as assignee_id, a.email as assignee_email, a.name as assignee_name, a.image as assignee_image
            FROM sessions s
            LEFT JOIN users u ON s.created_by = u.id
            LEFT JOIN users a ON (s.data->>'assignedTo') = a.id
            WHERE s.created_by = ${user.id} OR s.team_id IS NULL
            ORDER BY s.updated_at DESC
            LIMIT 100
          `;
          rows = result.rows;
        }
      } else {
        // User not in DB yet, show unassigned sessions
        const result = await sql`
          SELECT id, data, team_id, created_by, created_at, updated_at
          FROM sessions
          WHERE team_id IS NULL
          ORDER BY updated_at DESC
          LIMIT 50
        `;
        rows = result.rows;
      }
    } else {
      // Not authenticated - show unassigned sessions only
      const result = await sql`
        SELECT id, data, team_id, created_by, created_at, updated_at
        FROM sessions
        WHERE team_id IS NULL
        ORDER BY updated_at DESC
        LIMIT 50
      `;
      rows = result.rows;
    }

    const sessions = rows.map(row => ({
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
      assignedTo: row.data?.assignedTo,
      assignee: row.assignee_email ? {
        id: row.assignee_id,
        email: row.assignee_email,
        name: row.assignee_name,
        image: row.assignee_image,
      } : undefined,
    }));

    return Response.json({ sessions });
  } catch (error) {
    // Auto-initialize if table doesn't exist
    if (error instanceof Error && error.message.includes('relation "sessions" does not exist')) {
      try {
        await ensureTableExists();
        return Response.json({ sessions: [] });
      } catch (initError) {
        console.error('Error initializing sessions table:', initError);
      }
    }

    console.error('Error fetching sessions:', error);
    return Response.json({
      error: 'Failed to fetch sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/sessions - Create new session
export async function POST(request: Request) {
  try {
    const authSession = await getServerSession(authOptions);
    const body = await request.json();
    const sessionId = body.id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let userId: string | null = null;
    let teamId: string | null = null;
    let creator = undefined;

    // Get user and team info if authenticated
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

        // Get user's team if not specified
        if (body.teamId) {
          // Verify user is member
          const membership = await sql`
            SELECT 1 FROM team_members WHERE team_id = ${body.teamId} AND user_id = ${user.id} LIMIT 1
          `;
          if (membership.rows.length > 0) {
            teamId = body.teamId;
          }
        } else {
          const team = await getUserTeam(user.id);
          if (team) {
            teamId = team.id;
          }
        }
      }
    }

    const emptySession: PipelineSession = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      currentStep: 1,
      status: 'in_progress',
      teamId: teamId || undefined,
      createdBy: userId || undefined,
      creator,
      topic: { source: 'custom', slug: '', title: '' },
      blog: {
        frontmatter: {},
        content: '',
        htmlContent: '',
        status: 'draft'
      },
      linkedin: {
        posts: [],
        carousel: {},
        regenerationCount: 0
      },
      carousel: {
        slides: [],
        imageUrls: [],
        status: 'pending'
      },
      pdf: { status: 'pending' },
      export: {
        sheetsExported: false,
        driveUploaded: false
      },
      queue: {
        postsQueued: [],
        status: 'pending'
      },
    };

    try {
      await sql`
        INSERT INTO sessions (id, data, team_id, created_by, created_at, updated_at)
        VALUES (${sessionId}, ${JSON.stringify(emptySession)}, ${teamId}, ${userId}, NOW(), NOW())
      `;
    } catch (error) {
      // Auto-initialize if table doesn't exist
      if (error instanceof Error && error.message.includes('relation "sessions" does not exist')) {
        await ensureTableExists();
        await sql`
          INSERT INTO sessions (id, data, team_id, created_by, created_at, updated_at)
          VALUES (${sessionId}, ${JSON.stringify(emptySession)}, ${teamId}, ${userId}, NOW(), NOW())
        `;
      } else {
        throw error;
      }
    }

    return Response.json({ session: emptySession });
  } catch (error) {
    console.error('Error creating session:', error);
    return Response.json({
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
