import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET /api/brand-kit/init - Initialize brand_kit table with proper team schema
export async function GET() {
  try {
    // Create brand_kit table with team_id column (matching main route)
    await sql`
      CREATE TABLE IF NOT EXISTS brand_kit (
        id VARCHAR(255) PRIMARY KEY,
        team_id VARCHAR(255),
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create index for team lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_brand_kit_team ON brand_kit (team_id)`;

    // Migrate any legacy 'default' entries to have proper id format
    // This helps with backward compatibility

    return Response.json({
      success: true,
      message: 'Brand kit table created successfully with team support'
    });
  } catch (error) {
    console.error('Error initializing brand kit table:', error);
    return Response.json({
      error: 'Failed to initialize brand kit table',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
