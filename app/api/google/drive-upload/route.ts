import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pdfDataUrl, fileName } = await request.json();

    if (!pdfDataUrl) {
      return NextResponse.json({ error: 'PDF data URL required' }, { status: 400 });
    }

    // Check for Google service account credentials
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!serviceAccountJson || !folderId) {
      // Return mock success for demo purposes
      console.log('Google Drive upload (mock):', fileName);
      return NextResponse.json({
        success: true,
        message: 'Upload simulated (Google credentials not configured)',
        driveUrl: `https://drive.google.com/drive/folders/${folderId || 'demo'}`,
      });
    }

    // Parse service account credentials
    const credentials = JSON.parse(serviceAccountJson);

    // Get access token using service account
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: await createJWT(credentials),
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }

    const { access_token } = await tokenResponse.json();

    // Convert data URL to blob - use Buffer.from for Node.js compatibility
    const base64Data = pdfDataUrl.split(',')[1];
    const bytes = Buffer.from(base64Data, 'base64');

    // Create file metadata
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    // Create multipart form data
    const boundary = 'boundary_' + Date.now();
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelimiter = '\r\n--' + boundary + '--';

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/pdf\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Data +
      closeDelimiter;

    // Upload to Drive
    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Failed to upload to Drive: ${error}`);
    }

    const uploadResult = await uploadResponse.json();

    return NextResponse.json({
      success: true,
      fileId: uploadResult.id,
      driveUrl: `https://drive.google.com/file/d/${uploadResult.id}/view`,
    });
  } catch (error) {
    console.error('Error uploading to Drive:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

// Helper function to create JWT for Google authentication
async function createJWT(credentials: { client_email: string; private_key: string }) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;

  // Import private key - handle both literal \n and actual newlines
  const pemContents = credentials.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\\n/g, '')  // Remove literal \n strings
    .replace(/\s/g, '');  // Remove any whitespace

  // Use Buffer.from instead of atob for better compatibility
  const binaryKey = new Uint8Array(Buffer.from(pemContents, 'base64'));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(message)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${message}.${signatureB64}`;
}
