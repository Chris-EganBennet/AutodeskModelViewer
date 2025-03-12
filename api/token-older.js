// api/token.js - Standalone version without helper dependency
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    console.log('Token API called, attempting to get Forge token');
    console.log('Environment variables present:', {
      FORGE_CLIENT_ID: process.env.FORGE_CLIENT_ID ? 'Yes (hidden)' : 'No',
      FORGE_CLIENT_SECRET: process.env.FORGE_CLIENT_SECRET ? 'Yes (hidden)' : 'No'
    });
    
    // Get token directly without helper
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
      console.error('Authentication error from Forge:', data);
      throw new Error(`Authentication failed: ${JSON.stringify(data)}`);
    }
    
    console.log('Authentication successful');
    res.status(200).json({ access_token: data.access_token });
  } catch (error) {
    console.error('Error getting token:', error);
    // Return more detailed error information
    res.status(500).json({ 
      error: 'Failed to get access token', 
      message: error.message,
      name: error.name
    });
  }
};