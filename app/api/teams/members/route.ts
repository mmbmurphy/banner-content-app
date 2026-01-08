import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/teams/members - Get members of user's current team
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user (case-insensitive email match)
    const userResult = await sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${session.user.email}) LIMIT 1
    `;

    if (userResult.rows.length === 0) {
      return Response.json({ members: [] });
    }

    const userId = userResult.rows[0].id;

    // Get user's first team
    const teamResult = await sql`
      SELECT team_id FROM team_members WHERE user_id = ${userId} LIMIT 1
    `;

    if (teamResult.rows.length === 0) {
      return Response.json({ members: [] });
    }

    const teamId = teamResult.rows[0].team_id;

    // Get all team members
    const membersResult = await sql`
      SELECT u.id, u.email, u.name, u.image
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ${teamId}
      ORDER BY u.name ASC, u.email ASC
    `;

    return Response.json({
      members: membersResult.rows.map(row => ({
        id: row.id,
        email: row.email,
        name: row.name,
        image: row.image,
      })),
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return Response.json({
      error: 'Failed to fetch team members',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
