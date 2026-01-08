import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import type { Team, TeamMember, TeamRole } from '@/types/team';

export const dynamic = 'force-dynamic';

// Auto-initialize teams tables if they don't exist
async function ensureTablesExist() {
  // Users table (needed for foreign keys)
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      image TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Teams table
  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Team members table
  await sql`
    CREATE TABLE IF NOT EXISTS team_members (
      id VARCHAR(255) PRIMARY KEY,
      team_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'member',
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(team_id, user_id)
    )
  `;

  // Team invites table
  await sql`
    CREATE TABLE IF NOT EXISTS team_invites (
      id VARCHAR(255) PRIMARY KEY,
      team_id VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'member',
      invited_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      UNIQUE(team_id, email)
    )
  `;

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members (team_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites (email)`;
}

// GET /api/teams - List teams for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // First get the user (case-insensitive email match)
    const userResult = await sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${session.user.email}) LIMIT 1
    `;

    if (userResult.rows.length === 0) {
      return Response.json({ teams: [], pendingInvites: [] });
    }

    const userId = userResult.rows[0].id;

    // Get teams the user is a member of
    const teamsResult = await sql`
      SELECT t.*, tm.role,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
      FROM teams t
      INNER JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ${userId}
      ORDER BY t.created_at DESC
    `;

    // Get pending invites for this email (case-insensitive)
    const invitesResult = await sql`
      SELECT ti.*, t.name as team_name, t.slug as team_slug
      FROM team_invites ti
      INNER JOIN teams t ON ti.team_id = t.id
      WHERE LOWER(ti.email) = LOWER(${session.user.email})
        AND ti.status = 'pending'
        AND ti.expires_at > NOW()
      ORDER BY ti.created_at DESC
    `;

    const teams = teamsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      role: row.role as TeamRole,
      memberCount: parseInt(row.member_count),
    }));

    const pendingInvites = invitesResult.rows.map(row => ({
      id: row.id,
      teamId: row.team_id,
      teamName: row.team_name,
      teamSlug: row.team_slug,
      role: row.role as TeamRole,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));

    return Response.json({ teams, pendingInvites });
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      try {
        await ensureTablesExist();
        return Response.json({ teams: [], pendingInvites: [] });
      } catch (initError) {
        console.error('Error initializing teams tables:', initError);
      }
    }

    console.error('Error fetching teams:', error);
    return Response.json({
      error: 'Failed to fetch teams',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/teams - Create a new team
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || name.trim().length === 0) {
      return Response.json({ error: 'Team name is required' }, { status: 400 });
    }

    // First get or create the user (case-insensitive email match)
    const userResult = await sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${session.user.email}) LIMIT 1
    `;

    let userId: string;
    if (userResult.rows.length === 0) {
      // Create user if doesn't exist
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await sql`
        INSERT INTO users (id, email, name, image)
        VALUES (${userId}, ${session.user.email}, ${session.user.name || null}, ${session.user.image || null})
      `;
    } else {
      userId = userResult.rows[0].id;
    }

    // Generate team ID and slug
    const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substr(2, 4);

    const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create team
      await sql`
        INSERT INTO teams (id, name, slug, created_by)
        VALUES (${teamId}, ${name.trim()}, ${slug}, ${userId})
      `;

      // Add creator as owner
      await sql`
        INSERT INTO team_members (id, team_id, user_id, role)
        VALUES (${memberId}, ${teamId}, ${userId}, 'owner')
      `;
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        await ensureTablesExist();
        // Retry
        await sql`
          INSERT INTO teams (id, name, slug, created_by)
          VALUES (${teamId}, ${name.trim()}, ${slug}, ${userId})
        `;
        await sql`
          INSERT INTO team_members (id, team_id, user_id, role)
          VALUES (${memberId}, ${teamId}, ${userId}, 'owner')
        `;
      } else {
        throw error;
      }
    }

    return Response.json({
      success: true,
      team: {
        id: teamId,
        name: name.trim(),
        slug,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        role: 'owner',
        memberCount: 1,
      },
    });
  } catch (error) {
    console.error('Error creating team:', error);
    return Response.json({
      error: 'Failed to create team',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
