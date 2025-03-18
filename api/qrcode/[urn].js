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
    const elementId = req.query.elementId || '';
    
    if (!urn) {
      return res.status(400).json({ error: 'URN parameter is required' });
    }
    
    // Get hostname dynamically from request
    const hostname = req.headers.host;
    const protocol = hostname.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${hostname}`;
    
    // Create URL with both URN and elementId (if provided)
    let url = `${baseUrl}/view.html?urn=${urn}`;
    if (elementId) {
      url += `&elementId=${encodeURIComponent(elementId)}`;
    }
    
    const qrCode = await QRCode.toDataURL(url);
    
    res.status(200).json({ qrCode, url });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
};