import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';

export const dynamic = 'force-dynamic';

// POST /api/invites/accept - Accept a team invite
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { inviteId } = await request.json();

    if (!inviteId) {
      return Response.json({ error: 'inviteId is required' }, { status: 400 });
    }

    // Get the invite (case-insensitive email match)
    const inviteResult = await sql`
      SELECT * FROM team_invites
      WHERE id = ${inviteId}
        AND LOWER(email) = LOWER(${session.user.email})
        AND status = 'pending'
      LIMIT 1
    `;

    if (inviteResult.rows.length === 0) {
      return Response.json({ error: 'Invite not found or already used' }, { status: 404 });
    }

    const invite = inviteResult.rows[0];

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      await sql`UPDATE team_invites SET status = 'expired' WHERE id = ${inviteId}`;
      return Response.json({ error: 'Invite has expired' }, { status: 400 });
    }

    // Get or create user (case-insensitive email match)
    const userResult = await sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${session.user.email}) LIMIT 1
    `;

    let userId: string;
    if (userResult.rows.length === 0) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await sql`
        INSERT INTO users (id, email, name, image)
        VALUES (${userId}, ${session.user.email.toLowerCase()}, ${session.user.name || null}, ${session.user.image || null})
      `;
    } else {
      userId = userResult.rows[0].id;
    }

    // Check if already a member
    const existingMember = await sql`
      SELECT id FROM team_members
      WHERE team_id = ${invite.team_id} AND user_id = ${userId}
      LIMIT 1
    `;

    if (existingMember.rows.length > 0) {
      await sql`UPDATE team_invites SET status = 'accepted' WHERE id = ${inviteId}`;
      return Response.json({ error: 'You are already a member of this team' }, { status: 400 });
    }

    // Add user to team
    const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await sql`
      INSERT INTO team_members (id, team_id, user_id, role)
      VALUES (${memberId}, ${invite.team_id}, ${userId}, ${invite.role})
    `;

    // Mark invite as accepted
    await sql`UPDATE team_invites SET status = 'accepted' WHERE id = ${inviteId}`;

    // Get team info
    const teamResult = await sql`
      SELECT name, slug FROM teams WHERE id = ${invite.team_id} LIMIT 1
    `;

    return Response.json({
      success: true,
      team: {
        id: invite.team_id,
        name: teamResult.rows[0]?.name,
        slug: teamResult.rows[0]?.slug,
      },
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return Response.json({
      error: 'Failed to accept invite',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
