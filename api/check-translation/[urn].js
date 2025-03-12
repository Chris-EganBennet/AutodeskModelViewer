// api/check-translation/[urn].js
const fetch = require('node-fetch');

// Import the token function to reuse the same authentication logic
const { getForgeToken } = require('../_helpers/forge');

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
    const { urn } = req.query;
    
    if (!urn) {
      return res.status(400).json({ error: 'URN parameter is required' });
    }
    
    const token = await getForgeToken();
    
    // First, check the manifest to see if translation exists
    const manifestResponse = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    // Check response type
    const contentType = manifestResponse.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (manifestResponse.status === 404) {
      // Model needs translation, or URN is wrong
      return res.status(200).json({
        status: 'not_found', 
        message: 'Model not found or not yet translated',
        urn: urn
      });
    }
    
    if (manifestResponse.status !== 200) {
      const errorText = await manifestResponse.text();
      return res.status(manifestResponse.status).json({
        status: 'error',
        http_status: manifestResponse.status,
        message: errorText,
        urn: urn
      });
    }
    
    const manifestData = await manifestResponse.json();
    
    res.status(200).json({
      status: 'success',
      manifest: manifestData,
      urn: urn
    });
  } catch (error) {
    console.error('Error checking translation:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};