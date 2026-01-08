import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET /api/sessions/init - Initialize database table with team support
export async function GET() {
  const steps: string[] = [];

  try {
    // Create sessions table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    steps.push('Created sessions table (or already exists)');

    // Add team_id column if it doesn't exist (for team-based session sharing)
    try {
      await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS team_id VARCHAR(255)`;
      steps.push('Added team_id column');
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        throw e;
      }
      steps.push('team_id column already exists');
    }

    // Add created_by column if it doesn't exist
    try {
      await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_by VARCHAR(255)`;
      steps.push('Added created_by column');
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        throw e;
      }
      steps.push('created_by column already exists');
    }

    // Create indexes for faster queries
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions (updated_at DESC)`;
    steps.push('Created updated_at index');

    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_team ON sessions (team_id)`;
    steps.push('Created team_id index');

    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_creator ON sessions (created_by)`;
    steps.push('Created created_by index');

    // Verify the columns exist
    const columnCheck = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position
    `;
    const columns = columnCheck.rows.map(r => r.column_name);

    return Response.json({
      success: true,
      message: 'Database initialized successfully with team support',
      steps,
      columns
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    return Response.json({
      error: 'Failed to initialize database',
      details: error instanceof Error ? error.message : 'Unknown error',
      steps
    }, { status: 500 });
  }
}
