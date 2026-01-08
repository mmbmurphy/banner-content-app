import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import type { TeamRole } from '@/types/team';

export const dynamic = 'force-dynamic';

// Helper to check user's role in team
async function getUserTeamRole(teamId: string, userEmail: string): Promise<{ role: TeamRole; userId: string } | null> {
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
  return { role: memberResult.rows[0].role as TeamRole, userId: userResult.rows[0].id };
}

// PUT /api/teams/[teamId]/members - Update member role
export async function PUT(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { teamId } = params;
    const { memberId, role } = await request.json();

    if (!memberId || !role) {
      return Response.json({ error: 'memberId and role are required' }, { status: 400 });
    }

    // Check user is owner
    const userInfo = await getUserTeamRole(teamId, session.user.email);
    if (!userInfo || userInfo.role !== 'owner') {
      return Response.json({ error: 'Only owners can change member roles' }, { status: 403 });
    }

    // Can't change your own role
    const targetMember = await sql`
      SELECT user_id FROM team_members WHERE id = ${memberId} AND team_id = ${teamId} LIMIT 1
    `;

    if (targetMember.rows.length === 0) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    if (targetMember.rows[0].user_id === userInfo.userId) {
      return Response.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    await sql`
      UPDATE team_members
      SET role = ${role}
      WHERE id = ${memberId} AND team_id = ${teamId}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating member:', error);
    return Response.json({
      error: 'Failed to update member',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/teams/[teamId]/members?memberId=xxx - Remove member
export async function DELETE(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { teamId } = params;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return Response.json({ error: 'memberId is required' }, { status: 400 });
    }

    // Check user is owner or admin (or removing themselves)
    const userInfo = await getUserTeamRole(teamId, session.user.email);
    if (!userInfo) {
      return Response.json({ error: 'Not a member of this team' }, { status: 403 });
    }

    // Get target member info
    const targetMember = await sql`
      SELECT user_id, role FROM team_members WHERE id = ${memberId} AND team_id = ${teamId} LIMIT 1
    `;

    if (targetMember.rows.length === 0) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    const isSelf = targetMember.rows[0].user_id === userInfo.userId;
    const targetRole = targetMember.rows[0].role;

    // Rules:
    // - Can always leave yourself (unless you're the only owner)
    // - Only owners can remove others
    // - Can't remove other owners
    if (!isSelf) {
      if (userInfo.role !== 'owner') {
        return Response.json({ error: 'Only owners can remove other members' }, { status: 403 });
      }
      if (targetRole === 'owner') {
        return Response.json({ error: 'Cannot remove another owner' }, { status: 403 });
      }
    }

    // If leaving, check if only owner
    if (isSelf && userInfo.role === 'owner') {
      const ownerCount = await sql`
        SELECT COUNT(*) FROM team_members
        WHERE team_id = ${teamId} AND role = 'owner'
      `;
      if (parseInt(ownerCount.rows[0].count) <= 1) {
        return Response.json({
          error: 'Cannot leave - you are the only owner. Transfer ownership first.'
        }, { status: 400 });
      }
    }

    await sql`
      DELETE FROM team_members WHERE id = ${memberId} AND team_id = ${teamId}
    `;

    return Response.json({ success: true, leftTeam: isSelf });
  } catch (error) {
    console.error('Error removing member:', error);
    return Response.json({
      error: 'Failed to remove member',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
