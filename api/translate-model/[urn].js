// api/translate-model/[urn].js
const fetch = require('node-fetch');
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
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { urn } = req.query;
    
    if (!urn) {
      return res.status(400).json({ error: 'URN parameter is required' });
    }
    
    const token = await getForgeToken();
    
    // First check if it's already translated
    const manifestResponse = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
    // If already exists with status success, return early
    if (manifestResponse.ok) {
      const manifestData = await manifestResponse.json();
      if (manifestData.status === 'success') {
        return res.json({
          status: 'already_translated',
          manifest: manifestData
        });
      }
    }
    
    // Start translation job
    const translateResponse = await fetch(
      'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: {
            urn: urn
          },
          output: {
            formats: [
              {
                type: 'svf',
                views: ['2d', '3d']
              }
            ]
          }
        })
      }
    );
    
    const translateData = await translateResponse.json();
    
    if (translateResponse.ok) {
      res.json({
        status: 'translation_started',
        job: translateData
      });
    } else {
      res.status(translateResponse.status).json({
        status: 'error',
        error: translateData
      });
    }
  } catch (error) {
    console.error('Error initiating translation:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
}