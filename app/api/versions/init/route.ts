import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET /api/versions/init - Initialize versions table
export async function GET() {
  try {
    // Create content_versions table
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

    // Create indexes for faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_versions_session_step
      ON content_versions (session_id, step, created_at DESC)
    `;

    // Create session_notes column if it doesn't exist (for quick win)
    try {
      await sql`
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT
      `;
    } catch {
      // Column might already exist, ignore
    }

    return Response.json({
      success: true,
      message: 'Versions table and indexes created successfully'
    });
  } catch (error) {
    console.error('Error initializing versions table:', error);
    return Response.json({
      error: 'Failed to initialize versions table',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
