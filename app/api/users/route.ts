import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';

export const dynamic = 'force-dynamic';

// Auto-initialize users table if it doesn't exist
async function ensureTableExists() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      image TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)
  `;
}

// GET /api/users - Get current user
export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Case-insensitive email match
    const { rows } = await sql`
      SELECT id, email, name, image, created_at
      FROM users
      WHERE LOWER(email) = LOWER(${session.user.email})
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({ user: null });
    }

    return Response.json({
      user: {
        id: rows[0].id,
        email: rows[0].email,
        name: rows[0].name,
        image: rows[0].image,
        createdAt: rows[0].created_at,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('relation "users" does not exist')) {
      try {
        await ensureTableExists();
        return Response.json({ user: null });
      } catch (initError) {
        console.error('Error initializing users table:', initError);
      }
    }

    console.error('Error fetching user:', error);
    return Response.json({
      error: 'Failed to fetch user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/users - Create or update user (called from auth callback)
export async function POST(request: Request) {
  try {
    const { id, email, name, image } = await request.json();

    if (!id || !email) {
      return Response.json({ error: 'id and email are required' }, { status: 400 });
    }

    try {
      await sql`
        INSERT INTO users (id, email, name, image, updated_at)
        VALUES (${id}, ${email}, ${name || null}, ${image || null}, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          email = ${email},
          name = ${name || null},
          image = ${image || null},
          updated_at = NOW()
      `;
    } catch (error) {
      if (error instanceof Error && error.message.includes('relation "users" does not exist')) {
        await ensureTableExists();
        await sql`
          INSERT INTO users (id, email, name, image, updated_at)
          VALUES (${id}, ${email}, ${name || null}, ${image || null}, NOW())
          ON CONFLICT (id)
          DO UPDATE SET
            email = ${email},
            name = ${name || null},
            image = ${image || null},
            updated_at = NOW()
        `;
      } else {
        throw error;
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return Response.json({
      error: 'Failed to create/update user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
