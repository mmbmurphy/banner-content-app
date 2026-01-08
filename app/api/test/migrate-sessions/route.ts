import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET /api/test/migrate-sessions - Migrate existing sessions to have team_id
export async function GET() {
  const results: any[] = [];

  try {
    // Step 1: Find sessions without team_id
    const orphanedSessions = await sql`
      SELECT id, created_by, data->>'createdBy' as data_created_by
      FROM sessions
      WHERE team_id IS NULL
    `;

    results.push({
      step: 'Found orphaned sessions',
      count: orphanedSessions.rows.length,
      sessions: orphanedSessions.rows.map(r => ({
        id: r.id,
        created_by: r.created_by,
        data_created_by: r.data_created_by
      }))
    });

    let migratedCount = 0;

    // Step 2: For each orphaned session, try to find the user's team
    for (const session of orphanedSessions.rows) {
      // Try created_by column first, then data.createdBy
      const userId = session.created_by || session.data_created_by;

      if (!userId) {
        results.push({
          step: `Session ${session.id}`,
          status: 'skipped',
          reason: 'No creator info'
        });
        continue;
      }

      // Find user's team
      const teamResult = await sql`
        SELECT team_id FROM team_members WHERE user_id = ${userId} LIMIT 1
      `;

      if (teamResult.rows.length === 0) {
        results.push({
          step: `Session ${session.id}`,
          status: 'skipped',
          reason: `User ${userId} has no team`
        });
        continue;
      }

      const teamId = teamResult.rows[0].team_id;

      // Update the session with team_id and created_by
      await sql`
        UPDATE sessions
        SET team_id = ${teamId}, created_by = COALESCE(created_by, ${userId})
        WHERE id = ${session.id}
      `;

      migratedCount++;
      results.push({
        step: `Session ${session.id}`,
        status: 'migrated',
        teamId,
        userId
      });
    }

    // Step 3: Verify migration
    const stillOrphaned = await sql`
      SELECT COUNT(*) as count FROM sessions WHERE team_id IS NULL
    `;

    return Response.json({
      success: true,
      summary: {
        totalOrphaned: orphanedSessions.rows.length,
        migrated: migratedCount,
        stillOrphaned: parseInt(stillOrphaned.rows[0].count)
      },
      results
    });
  } catch (error) {
    console.error('Error migrating sessions:', error);
    return Response.json({
      error: 'Failed to migrate sessions',
      details: error instanceof Error ? error.message : 'Unknown error',
      results
    }, { status: 500 });
  }
}
