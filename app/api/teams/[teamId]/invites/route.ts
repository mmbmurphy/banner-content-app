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

// POST /api/teams/[teamId]/invites - Send an invite
export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { teamId } = params;
    const { email, role = 'member' } = await request.json();

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Check user is owner or admin
    const userInfo = await getUserTeamRole(teamId, session.user.email);
    if (!userInfo || (userInfo.role !== 'owner' && userInfo.role !== 'admin')) {
      return Response.json({ error: 'Only owners and admins can invite members' }, { status: 403 });
    }

    // Only owners can invite admins/owners
    if ((role === 'admin' || role === 'owner') && userInfo.role !== 'owner') {
      return Response.json({ error: 'Only owners can invite admins' }, { status: 403 });
    }

    // Check if email already has pending invite
    const existingInvite = await sql`
      SELECT id FROM team_invites
      WHERE team_id = ${teamId}
        AND email = ${email.toLowerCase()}
        AND status = 'pending'
      LIMIT 1
    `;

    if (existingInvite.rows.length > 0) {
      return Response.json({ error: 'An invite has already been sent to this email' }, { status: 400 });
    }

    // Check if user is already a member
    const existingUser = await sql`
      SELECT u.id FROM users u
      INNER JOIN team_members tm ON tm.user_id = u.id
      WHERE u.email = ${email.toLowerCase()} AND tm.team_id = ${teamId}
      LIMIT 1
    `;

    if (existingUser.rows.length > 0) {
      return Response.json({ error: 'This user is already a member of the team' }, { status: 400 });
    }

    // Create invite (expires in 7 days)
    const inviteId = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await sql`
      INSERT INTO team_invites (id, team_id, email, role, invited_by, expires_at, status)
      VALUES (${inviteId}, ${teamId}, ${email.toLowerCase()}, ${role}, ${userInfo.userId}, ${expiresAt.toISOString()}, 'pending')
    `;

    return Response.json({
      success: true,
      invite: {
        id: inviteId,
        email: email.toLowerCase(),
        role,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    return Response.json({
      error: 'Failed to create invite',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/teams/[teamId]/invites?inviteId=xxx - Cancel an invite
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
    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('inviteId');

    if (!inviteId) {
      return Response.json({ error: 'inviteId is required' }, { status: 400 });
    }

    // Check user is owner or admin
    const userInfo = await getUserTeamRole(teamId, session.user.email);
    if (!userInfo || (userInfo.role !== 'owner' && userInfo.role !== 'admin')) {
      return Response.json({ error: 'Only owners and admins can cancel invites' }, { status: 403 });
    }

    await sql`
      UPDATE team_invites
      SET status = 'cancelled'
      WHERE id = ${inviteId} AND team_id = ${teamId}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error canceling invite:', error);
    return Response.json({
      error: 'Failed to cancel invite',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
