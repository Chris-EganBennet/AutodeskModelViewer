// api/token.js
const fetch = require('node-fetch');
const { getForgeToken } = require('./_helpers/forge');

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
    
    const token = await getForgeToken();
    console.log('Token successfully obtained');
    res.status(200).json({ access_token: token });
  } catch (error) {
    console.log('Client ID length:', process.env.FORGE_CLIENT_ID ? process.env.FORGE_CLIENT_ID.length : 0);
    console.error('Error getting token:', error);
    // Return more detailed error information
    res.status(500).json({ 
      error: 'Failed to get access token', 
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      name: error.name
    });
  }
};