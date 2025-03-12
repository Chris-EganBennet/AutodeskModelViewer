// api/test-urn/[urn].js
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
  
  try {
    const { urn } = req.query;
    
    if (!urn) {
      return res.status(400).json({ error: 'URN parameter is required' });
    }
    
    const token = await getForgeToken();
    
    console.log(`Testing URN: ${urn}`);
    console.log(`Token available: ${!!token}`);
    
    // First, check if the model exists with a HEAD request
    const checkResponse = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
      {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('HEAD response status:', checkResponse.status);
    
    if (checkResponse.status === 404) {
      return res.status(404).json({ 
        error: 'Model not found', 
        urn: urn,
        status: checkResponse.status
      });
    }
    
    if (checkResponse.status === 401) {
      return res.status(401).json({ 
        error: 'Unauthorized access to this model', 
        urn: urn,
        status: checkResponse.status
      });
    }
    
    // Now make the actual GET request
    const response = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('GET response status:', response.status);
    
    // Try to get the text response first
    const textResponse = await response.text();
    console.log('Response text length:', textResponse.length);
    
    let jsonData;
    try {
      // Try to parse as JSON
      jsonData = JSON.parse(textResponse);
      res.json({
        urn: urn,
        manifest: jsonData,
        status: response.status
      });
    } catch (jsonError) {
      // If JSON parsing fails, return the text and error
      res.status(500).json({
        error: 'Failed to parse JSON response',
        text_response: textResponse,
        status: response.status,
        json_error: jsonError.message
      });
    }
  } catch (error) {
    console.error('Error testing URN:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};