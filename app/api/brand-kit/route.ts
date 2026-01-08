import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { DEFAULT_BRAND_KIT } from '@/types/brand';
import type { BrandKit } from '@/types/brand';

export const dynamic = 'force-dynamic';

// Auto-initialize brand_kit table if it doesn't exist
async function ensureTableExists() {
  await sql`
    CREATE TABLE IF NOT EXISTS brand_kit (
      id VARCHAR(255) PRIMARY KEY,
      team_id VARCHAR(255),
      data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_brand_kit_team ON brand_kit (team_id)`;
}

// Helper to get current user (case-insensitive email match)
async function getCurrentUser(email: string) {
  const result = await sql`
    SELECT id FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;
  return result.rows[0] || null;
}

// Helper to get user's team
async function getUserTeam(userId: string) {
  const result = await sql`
    SELECT t.id, t.name
    FROM teams t
    INNER JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = ${userId}
    ORDER BY t.created_at ASC
    LIMIT 1
  `;
  return result.rows[0] || null;
}

// GET /api/brand-kit - Get the brand kit for user's team
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    let teamId: string | null = null;

    // Get user's team if authenticated
    if (session?.user?.email) {
      const user = await getCurrentUser(session.user.email);
      if (user) {
        const team = await getUserTeam(user.id);
        if (team) {
          teamId = team.id;
        }
      }
    }

    // First, try to migrate old 'default' brand kit to team if needed
    if (teamId) {
      // Check if team already has a brand kit
      const teamBrandKit = await sql`
        SELECT id FROM brand_kit WHERE team_id = ${teamId} LIMIT 1
      `;

      if (teamBrandKit.rows.length === 0) {
        // Check for legacy 'default' brand kit to migrate
        const legacyKit = await sql`
          SELECT data FROM brand_kit WHERE id = 'default' LIMIT 1
        `;

        if (legacyKit.rows.length > 0) {
          // Migrate legacy brand kit to this team
          const newId = `brand_${teamId}`;
          await sql`
            INSERT INTO brand_kit (id, team_id, data, updated_at)
            VALUES (${newId}, ${teamId}, ${JSON.stringify(legacyKit.rows[0].data)}, NOW())
            ON CONFLICT (id) DO NOTHING
          `;
        }
      }
    }

    // Fetch brand kit for team (or default)
    let rows;
    if (teamId) {
      const result = await sql`
        SELECT data, updated_at
        FROM brand_kit
        WHERE team_id = ${teamId}
        LIMIT 1
      `;
      rows = result.rows;
    } else {
      // Fallback to legacy default for unauthenticated users
      const result = await sql`
        SELECT data, updated_at
        FROM brand_kit
        WHERE id = 'default'
        LIMIT 1
      `;
      rows = result.rows;
    }

    if (rows.length === 0) {
      return Response.json({ brandKit: DEFAULT_BRAND_KIT, isDefault: true });
    }

    return Response.json({
      brandKit: {
        ...rows[0].data,
        updatedAt: rows[0].updated_at,
      },
      isDefault: false,
    });
  } catch (error) {
    // Auto-initialize if table doesn't exist
    if (error instanceof Error && error.message.includes('relation "brand_kit" does not exist')) {
      try {
        await ensureTableExists();
        return Response.json({ brandKit: DEFAULT_BRAND_KIT, isDefault: true });
      } catch (initError) {
        console.error('Error initializing brand_kit table:', initError);
      }
    }

    console.error('Error fetching brand kit:', error);
    return Response.json({
      error: 'Failed to fetch brand kit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/brand-kit - Update the brand kit for user's team
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await getCurrentUser(session.user.email);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const team = await getUserTeam(user.id);
    if (!team) {
      return Response.json({ error: 'No team found. Create a team first.' }, { status: 400 });
    }

    const brandKit: BrandKit = await request.json();
    brandKit.id = `brand_${team.id}`;
    brandKit.updatedAt = new Date().toISOString();

    try {
      // Upsert the brand kit for this team
      await sql`
        INSERT INTO brand_kit (id, team_id, data, updated_at)
        VALUES (${brandKit.id}, ${team.id}, ${JSON.stringify(brandKit)}, NOW())
        ON CONFLICT (id)
        DO UPDATE SET data = ${JSON.stringify(brandKit)}, updated_at = NOW()
      `;
    } catch (error) {
      // Auto-initialize if table doesn't exist
      if (error instanceof Error && error.message.includes('relation "brand_kit" does not exist')) {
        await ensureTableExists();
        await sql`
          INSERT INTO brand_kit (id, team_id, data, updated_at)
          VALUES (${brandKit.id}, ${team.id}, ${JSON.stringify(brandKit)}, NOW())
          ON CONFLICT (id)
          DO UPDATE SET data = ${JSON.stringify(brandKit)}, updated_at = NOW()
        `;
      } else {
        throw error;
      }
    }

    return Response.json({
      success: true,
      brandKit,
    });
  } catch (error) {
    console.error('Error updating brand kit:', error);
    return Response.json({
      error: 'Failed to update brand kit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
