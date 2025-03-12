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
    const token = await getForgeToken();
    res.status(200).json({ access_token: token });
  } catch (error) {
    console.error('Error getting token:', error);
    res.status(500).json({ error: 'Failed to get access token' });
  }
};