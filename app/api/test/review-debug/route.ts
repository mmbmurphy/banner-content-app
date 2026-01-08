import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/test/review-debug - Debug review functionality
export async function GET() {
  const results: any[] = [];

  try {
    // Step 1: Check auth
    results.push({ step: '1. Check auth', status: 'starting' });
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      results.push({ step: '1. Check auth', status: 'failed', error: 'Not authenticated' });
      return Response.json({ success: false, results });
    }
    results[results.length - 1] = { step: '1. Check auth', status: 'ok', email: session.user.email };

    // Step 2: Get user from database
    results.push({ step: '2. Get user', status: 'starting' });
    const userResult = await sql`
      SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(${session.user.email}) LIMIT 1
    `;
    if (userResult.rows.length === 0) {
      results.push({ step: '2. Get user', status: 'failed', error: 'User not found in database' });
      return Response.json({ success: false, results });
    }
    const user = userResult.rows[0];
    results[results.length - 1] = { step: '2. Get user', status: 'ok', userId: user.id };

    // Step 3: Check if review_requests table exists
    results.push({ step: '3. Check table', status: 'starting' });
    try {
      const tableCheck = await sql`
        SELECT COUNT(*) FROM review_requests LIMIT 1
      `;
      results[results.length - 1] = { step: '3. Check table', status: 'ok', count: tableCheck.rows[0].count };
    } catch (e: any) {
      results[results.length - 1] = { step: '3. Check table', status: 'table_missing', error: e.message };

      // Try to create the table
      results.push({ step: '4. Create table', status: 'starting' });
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS review_requests (
            id VARCHAR(255) PRIMARY KEY,
            session_id VARCHAR(255) NOT NULL,
            step INTEGER,
            requester_id VARCHAR(255) NOT NULL,
            requester_name VARCHAR(255),
            requester_image TEXT,
            reviewer_id VARCHAR(255) NOT NULL,
            reviewer_name VARCHAR(255),
            reviewer_image TEXT,
            note TEXT,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            response_note TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            responded_at TIMESTAMP WITH TIME ZONE
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_review_session ON review_requests (session_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_review_reviewer ON review_requests (reviewer_id, status)`;
        results[results.length - 1] = { step: '4. Create table', status: 'ok', message: 'Table created' };
      } catch (createError: any) {
        results[results.length - 1] = { step: '4. Create table', status: 'failed', error: createError.message };
        return Response.json({ success: false, results });
      }
    }

    // Step 5: Get team members
    results.push({ step: '5. Get team members', status: 'starting' });
    try {
      const membersResult = await sql`
        SELECT u.id, u.email, u.name
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id IN (
          SELECT team_id FROM team_members WHERE user_id = ${user.id}
        )
        LIMIT 10
      `;
      results[results.length - 1] = {
        step: '5. Get team members',
        status: 'ok',
        members: membersResult.rows.map(r => ({ id: r.id, name: r.name || r.email }))
      };
    } catch (e: any) {
      results[results.length - 1] = { step: '5. Get team members', status: 'failed', error: e.message };
    }

    // Step 6: Test insert
    results.push({ step: '6. Test insert', status: 'starting' });
    const testId = `test_${Date.now()}`;
    try {
      await sql`
        INSERT INTO review_requests (id, session_id, requester_id, reviewer_id, status)
        VALUES (${testId}, 'test_session', ${user.id}, ${user.id}, 'pending')
      `;
      results[results.length - 1] = { step: '6. Test insert', status: 'ok', testId };

      // Clean up
      await sql`DELETE FROM review_requests WHERE id = ${testId}`;
      results.push({ step: '7. Cleanup', status: 'ok' });
    } catch (e: any) {
      results[results.length - 1] = { step: '6. Test insert', status: 'failed', error: e.message };
    }

    return Response.json({ success: true, results });
  } catch (error: any) {
    results.push({ step: 'Unexpected error', error: error.message });
    return Response.json({ success: false, results, error: error.message }, { status: 500 });
  }
}
