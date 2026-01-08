import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// Auto-initialize versions table if it doesn't exist
async function ensureTableExists() {
  await sql`
    CREATE TABLE IF NOT EXISTS content_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR(255) NOT NULL,
      step VARCHAR(50) NOT NULL,
      content JSONB NOT NULL,
      prompt_used TEXT,
      created_by VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_versions_session_step
    ON content_versions (session_id, step, created_at DESC)
  `;
}

// GET /api/versions?sessionId=xxx&step=blog - List versions for a session/step
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const step = searchParams.get('step');

    if (!sessionId) {
      return Response.json({ error: 'sessionId is required' }, { status: 400 });
    }

    let query;
    if (step) {
      query = await sql`
        SELECT id, session_id, step, content, prompt_used, created_at, created_by
        FROM content_versions
        WHERE session_id = ${sessionId} AND step = ${step}
        ORDER BY created_at DESC
        LIMIT 50
      `;
    } else {
      query = await sql`
        SELECT id, session_id, step, content, prompt_used, created_at, created_by
        FROM content_versions
        WHERE session_id = ${sessionId}
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }

    return Response.json({ versions: query.rows });
  } catch (error) {
    // Auto-initialize if table doesn't exist
    if (error instanceof Error && error.message.includes('relation "content_versions" does not exist')) {
      try {
        await ensureTableExists();
        return Response.json({ versions: [] });
      } catch (initError) {
        console.error('Error initializing versions table:', initError);
      }
    }

    console.error('Error fetching versions:', error);
    return Response.json({
      error: 'Failed to fetch versions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/versions - Create a new version
export async function POST(request: Request) {
  try {
    const { sessionId, step, content, promptUsed, createdBy } = await request.json();

    if (!sessionId || !step || !content) {
      return Response.json({
        error: 'sessionId, step, and content are required'
      }, { status: 400 });
    }

    try {
      const result = await sql`
        INSERT INTO content_versions (session_id, step, content, prompt_used, created_by)
        VALUES (${sessionId}, ${step}, ${JSON.stringify(content)}, ${promptUsed || null}, ${createdBy || null})
        RETURNING id, created_at
      `;

      return Response.json({
        success: true,
        versionId: result.rows[0].id,
        createdAt: result.rows[0].created_at
      });
    } catch (error) {
      // Auto-initialize if table doesn't exist
      if (error instanceof Error && error.message.includes('relation "content_versions" does not exist')) {
        await ensureTableExists();
        const result = await sql`
          INSERT INTO content_versions (session_id, step, content, prompt_used, created_by)
          VALUES (${sessionId}, ${step}, ${JSON.stringify(content)}, ${promptUsed || null}, ${createdBy || null})
          RETURNING id, created_at
        `;

        return Response.json({
          success: true,
          versionId: result.rows[0].id,
          createdAt: result.rows[0].created_at
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating version:', error);
    return Response.json({
      error: 'Failed to create version',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
