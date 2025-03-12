// api/token.js
import fetch from 'node-fetch';

// Get Forge token
async function getForgeToken() {
  try {
    console.log('Using Client ID:', process.env.FORGE_CLIENT_ID ? 'Provided (not shown for security)' : 'MISSING');
    console.log('Using Client Secret:', process.env.FORGE_CLIENT_SECRET ? 'Provided (not shown for security)' : 'MISSING');

    // New OAuth 2.0 endpoint
    const response = await fetch(
      'https://developer.api.autodesk.com/authentication/v2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.FORGE_CLIENT_ID,
          client_secret: process.env.FORGE_CLIENT_SECRET,
          grant_type: 'client_credentials',
          scope: 'data:read data:write viewables:read bucket:read account:read user-profile:read'
        })
      }
    );

    const data = await response.json();
    
    if (!data.access_token) {
      console.error('Authentication error:', data);
      throw new Error(`Authentication failed: ${JSON.stringify(data)}`);
    }
    
    console.log('Authentication successful');
    return data.access_token;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

// Vercel API handler
export default async function handler(req, res) {
  try {
    const token = await getForgeToken();
    res.status(200).json({ access_token: token });
  } catch (error) {
    console.error('Error getting token:', error);
    res.status(500).json({ error: 'Failed to get access token' });
  }
};