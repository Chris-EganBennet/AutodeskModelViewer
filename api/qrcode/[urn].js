// api/qrcode/[urn].js
const QRCode = require('qrcode');

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
    
    // Get element ID parameters - support both formats
    const elementId = req.query.elementId || '';
    const elementPath = req.query.elementPath || '';
    
    if (!urn) {
      return res.status(400).json({ error: 'URN parameter is required' });
    }
    
    // Get hostname dynamically from request
    const hostname = req.headers.host;
    const protocol = hostname.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${hostname}`;
    
    // Create URL with parameters
    let url = `${baseUrl}/view.html?urn=${urn}`;
    
    // Add element ID if provided (direct ID or name)
    if (elementId) {
      url += `&elementId=${encodeURIComponent(elementId)}`;
    }
    
    // Add element path if provided (for deeply nested elements)
    if (elementPath) {
      url += `&elementPath=${encodeURIComponent(elementPath)}`;
    }
    
    const qrCode = await QRCode.toDataURL(url);
    
    res.status(200).json({ 
      qrCode, 
      url,
      params: {
        urn,
        elementId: elementId || null,
        elementPath: elementPath || null
      }
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
};