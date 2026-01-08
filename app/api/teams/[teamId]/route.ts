import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import type { TeamRole } from '@/types/team';

export const dynamic = 'force-dynamic';

// Helper to check user's role in team
async function getUserTeamRole(teamId: string, userEmail: string): Promise<TeamRole | null> {
  const userResult = await sql`
    SELECT u.id FROM users u WHERE u.email = ${userEmail} LIMIT 1
  `;

  if (userResult.rows.length === 0) return null;

  const memberResult = await sql`
    SELECT role FROM team_members
    WHERE team_id = ${teamId} AND user_id = ${userResult.rows[0].id}
    LIMIT 1
  `;

  if (memberResult.rows.length === 0) return null;
  return memberResult.rows[0].role as TeamRole;
}

// GET /api/teams/[teamId] - Get team details with members
export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { teamId } = params;

    // Check user is a member
    const role = await getUserTeamRole(teamId, session.user.email);
    if (!role) {
      return Response.json({ error: 'Not a member of this team' }, { status: 403 });
    }

    // Get team details
    const teamResult = await sql`
      SELECT * FROM teams WHERE id = ${teamId} LIMIT 1
    `;

    if (teamResult.rows.length === 0) {
      return Response.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get members
    const membersResult = await sql`
      SELECT tm.*, u.email, u.name, u.image
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ${teamId}
      ORDER BY tm.joined_at ASC
    `;

    // Get pending invites (only for admins/owners)
    let invites: any[] = [];
    if (role === 'owner' || role === 'admin') {
      const invitesResult = await sql`
        SELECT ti.*, u.name as inviter_name, u.email as inviter_email
        FROM team_invites ti
        LEFT JOIN users u ON ti.invited_by = u.id
        WHERE ti.team_id = ${teamId} AND ti.status = 'pending'
        ORDER BY ti.created_at DESC
      `;
      invites = invitesResult.rows.map(row => ({
        id: row.id,
        email: row.email,
        role: row.role,
        invitedBy: {
          id: row.invited_by,
          name: row.inviter_name,
          email: row.inviter_email,
        },
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }));
    }

    const team = teamResult.rows[0];
    return Response.json({
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        createdBy: team.created_by,
        createdAt: team.created_at,
        updatedAt: team.updated_at,
      },
      members: membersResult.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        role: row.role,
        joinedAt: row.joined_at,
        user: {
          id: row.user_id,
          email: row.email,
          name: row.name,
          image: row.image,
        },
      })),
      invites,
      currentUserRole: role,
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return Response.json({
      error: 'Failed to fetch team',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/teams/[teamId] - Update team
export async function PUT(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { teamId } = params;
    const { name } = await request.json();

    // Check user is owner or admin
    const role = await getUserTeamRole(teamId, session.user.email);
    if (role !== 'owner' && role !== 'admin') {
      return Response.json({ error: 'Only owners and admins can update team' }, { status: 403 });
    }

    if (!name || name.trim().length === 0) {
      return Response.json({ error: 'Team name is required' }, { status: 400 });
    }

    await sql`
      UPDATE teams
      SET name = ${name.trim()}, updated_at = NOW()
      WHERE id = ${teamId}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating team:', error);
    return Response.json({
      error: 'Failed to update team',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/teams/[teamId] - Delete team
export async function DELETE(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { teamId } = params;

    // Check user is owner
    const role = await getUserTeamRole(teamId, session.user.email);
    if (role !== 'owner') {
      return Response.json({ error: 'Only the owner can delete a team' }, { status: 403 });
    }

    // Delete in order: invites, members, team
    await sql`DELETE FROM team_invites WHERE team_id = ${teamId}`;
    await sql`DELETE FROM team_members WHERE team_id = ${teamId}`;
    await sql`DELETE FROM teams WHERE id = ${teamId}`;

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return Response.json({
      error: 'Failed to delete team',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
