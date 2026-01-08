import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

interface TestResult {
  step: string;
  success: boolean;
  details?: any;
  error?: string;
}

// GET /api/test/session-sharing - Test that session sharing between team members works
export async function GET() {
  const results: TestResult[] = [];
  const testPrefix = `test_${Date.now()}`;

  // Test data IDs for cleanup
  const testIds = {
    user1: `${testPrefix}_user1`,
    user2: `${testPrefix}_user2`,
    team: `${testPrefix}_team`,
    member1: `${testPrefix}_member1`,
    member2: `${testPrefix}_member2`,
    session: `${testPrefix}_session`,
  };

  try {
    // Step 1: Create test team
    results.push({ step: '1. Create test team', success: false });
    try {
      await sql`
        INSERT INTO teams (id, name, slug, created_by, created_at)
        VALUES (${testIds.team}, 'Test Team', ${testPrefix + '-team'}, ${testIds.user1}, NOW())
      `;
      results[results.length - 1].success = true;
      results[results.length - 1].details = { teamId: testIds.team };
    } catch (e: any) {
      results[results.length - 1].error = e.message;
      throw new Error(`Failed to create team: ${e.message}`);
    }

    // Step 2: Create test user 1
    results.push({ step: '2. Create test user 1', success: false });
    try {
      await sql`
        INSERT INTO users (id, email, name, created_at)
        VALUES (${testIds.user1}, ${testPrefix + '_user1@test.com'}, 'Test User 1', NOW())
      `;
      results[results.length - 1].success = true;
      results[results.length - 1].details = { userId: testIds.user1 };
    } catch (e: any) {
      results[results.length - 1].error = e.message;
      throw new Error(`Failed to create user 1: ${e.message}`);
    }

    // Step 3: Create test user 2
    results.push({ step: '3. Create test user 2', success: false });
    try {
      await sql`
        INSERT INTO users (id, email, name, created_at)
        VALUES (${testIds.user2}, ${testPrefix + '_user2@test.com'}, 'Test User 2', NOW())
      `;
      results[results.length - 1].success = true;
      results[results.length - 1].details = { userId: testIds.user2 };
    } catch (e: any) {
      results[results.length - 1].error = e.message;
      throw new Error(`Failed to create user 2: ${e.message}`);
    }

    // Step 4: Add both users to the team
    results.push({ step: '4. Add user 1 to team', success: false });
    try {
      await sql`
        INSERT INTO team_members (id, team_id, user_id, role, joined_at)
        VALUES (${testIds.member1}, ${testIds.team}, ${testIds.user1}, 'owner', NOW())
      `;
      results[results.length - 1].success = true;
    } catch (e: any) {
      results[results.length - 1].error = e.message;
      throw new Error(`Failed to add user 1 to team: ${e.message}`);
    }

    results.push({ step: '5. Add user 2 to team', success: false });
    try {
      await sql`
        INSERT INTO team_members (id, team_id, user_id, role, joined_at)
        VALUES (${testIds.member2}, ${testIds.team}, ${testIds.user2}, 'member', NOW())
      `;
      results[results.length - 1].success = true;
    } catch (e: any) {
      results[results.length - 1].error = e.message;
      throw new Error(`Failed to add user 2 to team: ${e.message}`);
    }

    // Step 5: Verify team membership for both users
    results.push({ step: '6. Verify team membership', success: false });
    try {
      const membershipCheck = await sql`
        SELECT user_id, role FROM team_members WHERE team_id = ${testIds.team}
      `;
      const members = membershipCheck.rows;
      if (members.length !== 2) {
        throw new Error(`Expected 2 members, found ${members.length}`);
      }
      results[results.length - 1].success = true;
      results[results.length - 1].details = { members };
    } catch (e: any) {
      results[results.length - 1].error = e.message;
      throw new Error(`Team membership verification failed: ${e.message}`);
    }

    // Step 6: User 1 creates a session WITH team_id
    results.push({ step: '7. User 1 creates session', success: false });
    const sessionData = {
      id: testIds.session,
      createdAt: new Date().toISOString(),
      currentStep: 1,
      status: 'in_progress',
      teamId: testIds.team,
      createdBy: testIds.user1,
      topic: { source: 'custom', slug: 'test-topic', title: 'Test Topic' },
      blog: { frontmatter: {}, content: 'Test content', htmlContent: '', status: 'draft' },
      linkedin: { posts: [], carousel: {}, regenerationCount: 0 },
      carousel: { slides: [], imageUrls: [], status: 'pending' },
      pdf: { status: 'pending' },
      export: { sheetsExported: false, driveUploaded: false },
      queue: { postsQueued: [], status: 'pending' },
    };
    try {
      await sql`
        INSERT INTO sessions (id, data, team_id, created_by, created_at, updated_at)
        VALUES (${testIds.session}, ${JSON.stringify(sessionData)}, ${testIds.team}, ${testIds.user1}, NOW(), NOW())
      `;
      results[results.length - 1].success = true;
      results[results.length - 1].details = { sessionId: testIds.session, teamId: testIds.team };
    } catch (e: any) {
      results[results.length - 1].error = e.message;
      throw new Error(`Failed to create session: ${e.message}`);
    }

    // Step 7: Verify session was created with correct team_id
    results.push({ step: '8. Verify session has team_id', success: false });
    try {
      const sessionCheck = await sql`
        SELECT id, team_id, created_by FROM sessions WHERE id = ${testIds.session}
      `;
      if (sessionCheck.rows.length === 0) {
        throw new Error('Session not found in database');
      }
      const session = sessionCheck.rows[0];
      if (session.team_id !== testIds.team) {
        throw new Error(`Session team_id is "${session.team_id}", expected "${testIds.team}"`);
      }
      results[results.length - 1].success = true;
      results[results.length - 1].details = session;
    } catch (e: any) {
      results[results.length - 1].error = e.message;
      throw new Error(`Session verification failed: ${e.message}`);
    }

    // Step 8: Query sessions as User 2 (simulating the API query)
    results.push({ step: '9. User 2 queries team sessions', success: false });
    try {
      // This simulates what the GET /api/sessions endpoint does
      // First verify user 2 is a member of the team
      const membershipVerify = await sql`
        SELECT 1 FROM team_members WHERE team_id = ${testIds.team} AND user_id = ${testIds.user2} LIMIT 1
      `;
      if (membershipVerify.rows.length === 0) {
        throw new Error('User 2 is not a member of the team');
      }

      // Now query sessions for this team (same query as the sessions API)
      const sessionsResult = await sql`
        SELECT s.id, s.data, s.team_id, s.created_by, s.created_at, s.updated_at
        FROM sessions s
        WHERE s.team_id = ${testIds.team}
        ORDER BY s.updated_at DESC
      `;

      const foundSession = sessionsResult.rows.find(r => r.id === testIds.session);
      if (!foundSession) {
        throw new Error(`User 2 cannot see session ${testIds.session} - Sessions returned: ${sessionsResult.rows.length}`);
      }

      results[results.length - 1].success = true;
      results[results.length - 1].details = {
        sessionsFound: sessionsResult.rows.length,
        sessionVisible: true,
        session: foundSession
      };
    } catch (e: any) {
      results[results.length - 1].error = e.message;
      throw new Error(`User 2 session query failed: ${e.message}`);
    }

    // Step 9: Test the exact query used by the frontend API
    results.push({ step: '10. Test exact frontend API query', success: false });
    try {
      // Simulate what happens when frontend calls GET /api/sessions?teamId=xxx
      const sessionsResult = await sql`
        SELECT s.id, s.data, s.team_id, s.created_by, s.created_at, s.updated_at,
               u.email as creator_email, u.name as creator_name, u.image as creator_image
        FROM sessions s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.team_id = ${testIds.team}
        ORDER BY s.updated_at DESC
        LIMIT 100
      `;

      const foundSession = sessionsResult.rows.find(r => r.id === testIds.session);
      if (!foundSession) {
        throw new Error(`Frontend API query would NOT return the session`);
      }

      results[results.length - 1].success = true;
      results[results.length - 1].details = {
        totalSessions: sessionsResult.rows.length,
        testSessionFound: true,
        query: `SELECT ... WHERE team_id = '${testIds.team}'`
      };
    } catch (e: any) {
      results[results.length - 1].error = e.message;
      throw new Error(`Frontend API query test failed: ${e.message}`);
    }

    // All tests passed
    results.push({
      step: 'FINAL: All tests passed!',
      success: true,
      details: {
        summary: 'Session sharing between team members is working correctly at the database level.',
        note: 'If users still cannot see shared sessions, the issue is likely in the frontend (localStorage, store hydration, or team context).'
      }
    });

  } catch (error: any) {
    results.push({
      step: 'TEST FAILED',
      success: false,
      error: error.message
    });
  } finally {
    // Cleanup: Delete test data
    const cleanupResults: string[] = [];
    try {
      await sql`DELETE FROM sessions WHERE id = ${testIds.session}`;
      cleanupResults.push('Deleted test session');
    } catch (e) {
      cleanupResults.push('Failed to delete test session');
    }
    try {
      await sql`DELETE FROM team_members WHERE team_id = ${testIds.team}`;
      cleanupResults.push('Deleted test team members');
    } catch (e) {
      cleanupResults.push('Failed to delete test team members');
    }
    try {
      await sql`DELETE FROM teams WHERE id = ${testIds.team}`;
      cleanupResults.push('Deleted test team');
    } catch (e) {
      cleanupResults.push('Failed to delete test team');
    }
    try {
      await sql`DELETE FROM users WHERE id IN (${testIds.user1}, ${testIds.user2})`;
      cleanupResults.push('Deleted test users');
    } catch (e) {
      cleanupResults.push('Failed to delete test users');
    }

    results.push({
      step: 'Cleanup',
      success: true,
      details: cleanupResults
    });
  }

  const allPassed = results.filter(r => r.step !== 'Cleanup' && r.step !== 'TEST FAILED').every(r => r.success);

  return Response.json({
    success: allPassed,
    testPrefix,
    results
  }, {
    status: allPassed ? 200 : 500
  });
}
