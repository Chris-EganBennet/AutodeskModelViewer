const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const QRCode = require('qrcode');
const fetch = require('node-fetch');

// Load environment variables
dotenv.config();

// Debug environment variables (sanitized)
console.log('Environment loaded:');
console.log('FORGE_CLIENT_ID exists:', process.env.FORGE_CLIENT_ID ? 'Yes' : 'No');
console.log('FORGE_CLIENT_SECRET exists:', process.env.FORGE_CLIENT_SECRET ? 'Yes' : 'No');

const app = express();
const PORT = process.env.PORT || 3000;

// Static files
app.use(express.static('public'));
app.use(express.json());

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

// API endpoint for token
app.get('/api/token', async (req, res) => {
  try {
    const token = await getForgeToken();
    res.json({ access_token: token });
  } catch (error) {
    console.error('Error getting token:', error);
    res.status(500).json({ error: 'Failed to get access token' });
  }
});

// Generate QR code for a specific model URN
app.get('/api/qrcode/:urn', async (req, res) => {
  try {
    const { urn } = req.params;
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const url = `${baseUrl}/view.html?urn=${urn}`;
    
    const qrCode = await QRCode.toDataURL(url);
    res.json({ qrCode });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Serve index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve view page
app.get('/view.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

// Add this to server.js (for debugging)
app.get('/api/test-urn/:urn', async (req, res) => {
    try {
      const { urn } = req.params;
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
  });

  app.get('/api/token-test', async (req, res) => {
    try {
      const token = await getForgeToken();
      
      // Test the token with a simple API call to get hubs
      const hubsResponse = await fetch(
        'https://developer.api.autodesk.com/project/v1/hubs',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const hubsData = await hubsResponse.json();
      
      // Return token info and test results
      res.json({
        token_exists: !!token,
        token_length: token ? token.length : 0,
        hubs_test: hubsData
      });
    } catch (error) {
      console.error('Error testing token:', error);
      res.status(500).json({ 
        error: error.message,
        stack: error.stack
      });
    }
  });

  app.get('/api/urn-formats/:urn', async (req, res) => {
    try {
      const { urn } = req.params;
      const token = await getForgeToken();
      
      // Try different URN formats
      const formats = {
        original: urn,
        withUrnPrefix: urn.startsWith('urn:') ? urn : `urn:${urn}`,
        decoded: null,
        decodedWithPrefix: null
      };
      
      // Try to decode if it looks like Base64
      if (/^[a-zA-Z0-9+/=]+$/.test(urn)) {
        try {
          formats.decoded = Buffer.from(urn, 'base64').toString();
          formats.decodedWithPrefix = `urn:${formats.decoded}`;
        } catch (e) {
          console.log('Failed to decode URN as Base64');
        }
      }
      
      // Results for each format
      const results = {};
      
      // Test each format
      for (const [format, testUrn] of Object.entries(formats)) {
        if (!testUrn) continue;
        
        try {
          const encodedUrn = format.includes('decoded') ? testUrn : testUrn;
          
          const response = await fetch(
            `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodedUrn}/manifest`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          const textResponse = await response.text();
          let jsonData;
          
          try {
            jsonData = JSON.parse(textResponse);
          } catch (e) {
            jsonData = { error: 'Invalid JSON response', text: textResponse };
          }
          
          results[format] = {
            urn: testUrn,
            status: response.status,
            response: jsonData
          };
        } catch (error) {
          results[format] = {
            urn: testUrn,
            error: error.message
          };
        }
      }
      
      res.json(results);
    } catch (error) {
      console.error('Error testing URN formats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/check-translation/:urn', async (req, res) => {
    try {
      const { urn } = req.params;
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
        res.json({
          status: 'not_found', 
          message: 'Model not found or not yet translated',
          urn: urn
        });
        return;
      }
      
      if (manifestResponse.status !== 200) {
        const errorText = await manifestResponse.text();
        res.status(manifestResponse.status).json({
          status: 'error',
          http_status: manifestResponse.status,
          message: errorText,
          urn: urn
        });
        return;
      }
      
      const manifestData = await manifestResponse.json();
      
      res.json({
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
  });

  app.get('/api/test-acc', async (req, res) => {
    try {
      const token = await getForgeToken();
      console.log('Testing ACC access with token');
      
      // First, get hubs to see if ACC is accessible
      const hubsResponse = await fetch(
        'https://developer.api.autodesk.com/project/v1/hubs',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const hubsData = await hubsResponse.json();
      
      // If no hubs or error, likely ACC integration issue
      if (!hubsData.data || hubsData.data.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No ACC hubs found. Your Forge app is likely not provisioned for ACC or not added to your ACC account.',
          response: hubsData
        });
      }
      
      const accHubs = hubsData.data.filter(hub => 
        hub.attributes && hub.attributes.extension && 
        hub.attributes.extension.type === 'hubs:autodesk.bim360:Account'
      );
      
      if (accHubs.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No ACC hubs found. Found other hubs but not ACC.',
          hubs: hubsData.data.map(h => h.attributes.name),
          response: hubsData
        });
      }
      
      // Get the first ACC hub
      const accHub = accHubs[0];
      
      // Try to get projects for this hub
      const projectsResponse = await fetch(
        `https://developer.api.autodesk.com/project/v1/hubs/${accHub.id}/projects`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const projectsData = await projectsResponse.json();
      
      // Return full diagnostic info
      res.json({
        status: 'success',
        message: 'ACC access test completed',
        accHubs: accHubs.map(h => ({
          id: h.id,
          name: h.attributes.name,
          region: h.attributes.region
        })),
        projects: projectsData.data ? 
          projectsData.data.map(p => ({
            id: p.id,
            name: p.attributes.name
          })) : 
          'No projects found'
      });
      
    } catch (error) {
      console.error('Error testing ACC access:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error testing ACC access',
        error: error.message,
        stack: error.stack
      });
    }
  });
  app.get('/api/test-acc-model/:urn', async (req, res) => {
    try {
      const { urn } = req.params;
      const token = await getForgeToken();
      
      console.log(`Testing ACC model URN: ${urn}`);
      
      // 1. Try to decode the URN to see what it contains
      let decodedUrn;
      try {
        decodedUrn = Buffer.from(urn, 'base64').toString();
        console.log(`Decoded URN: ${decodedUrn}`);
      } catch (e) {
        console.error('Failed to decode URN as Base64', e);
      }
      
      // 2. Check if this is an ACC model based on the URN pattern
      const isAccUrn = decodedUrn && decodedUrn.includes('adsk.wipemea');
      
      // 3. Test if we can get the manifest for this model
      let manifestResult;
      try {
        const manifestResponse = await fetch(
          `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (manifestResponse.ok) {
          manifestResult = {
            status: 'success',
            data: await manifestResponse.json()
          };
        } else {
          const errorText = await manifestResponse.text();
          manifestResult = {
            status: 'error',
            statusCode: manifestResponse.status,
            error: errorText
          };
        }
      } catch (error) {
        manifestResult = {
          status: 'exception',
          error: error.message
        };
      }
      
      // 4. If manifest failed, check if we can at least access ACC
      let accAccessResult = null;
      if (manifestResult.status !== 'success' && isAccUrn) {
        try {
          const hubsResponse = await fetch(
            'https://developer.api.autodesk.com/project/v1/hubs',
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          const hubsData = await hubsResponse.json();
          
          accAccessResult = {
            status: hubsData.data && hubsData.data.length > 0 ? 'success' : 'error',
            message: hubsData.data && hubsData.data.length > 0 ? 
              'ACC account accessible' : 'No ACC hubs found',
            data: hubsData
          };
        } catch (error) {
          accAccessResult = {
            status: 'error',
            message: 'Exception accessing ACC',
            error: error.message
          };
        }
      }
      
      // 5. Provide diagnosis
      let diagnosis = 'Unknown issue';
      let solution = 'Unknown solution';
      
      if (manifestResult.status === 'success') {
        diagnosis = 'Model accessible';
        solution = 'Your token and URN are valid. If viewer still has issues, check region settings.';
      } else if (manifestResult.statusCode === 401) {
        if (accAccessResult && accAccessResult.status === 'success') {
          diagnosis = 'ACC accessible but this specific model is not';
          solution = 'Your app has ACC access but not to this specific model. Check project permissions or model visibility.';
        } else {
          diagnosis = 'No ACC access';
          solution = 'Your app does not have ACC integration. Follow the ACC Integration steps in the documentation.';
        }
      } else if (manifestResult.statusCode === 404) {
        diagnosis = 'Model not found';
        solution = 'The URN is invalid or the model has not been translated for viewing.';
      }
      
      // Return comprehensive diagnostic info
      res.json({
        urn: urn,
        decodedUrn: decodedUrn,
        isAccModel: isAccUrn,
        diagnosis: diagnosis,
        solution: solution,
        manifestResult: manifestResult,
        accAccessResult: accAccessResult
      });
      
    } catch (error) {
      console.error('Error testing ACC model:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error in ACC model test',
        error: error.message
      });
    }
  });

// Updated function to find models in ACC
// Add this to server.js to replace the previous find-models endpoint

app.get('/api/find-models', async (req, res) => {
    try {
      const token = await getForgeToken();
      const modelsFound = [];
      
      // Get all hubs (ACC accounts)
      const hubsResponse = await fetch(
        'https://developer.api.autodesk.com/project/v1/hubs',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const hubsData = await hubsResponse.json();
      const hubs = hubsData.data || [];
      
      // Find all projects in all hubs
      const allProjects = [];
      for (const hub of hubs) {
        try {
          const projectsResponse = await fetch(
            `https://developer.api.autodesk.com/project/v1/hubs/${hub.id}/projects`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          const projectsData = await projectsResponse.json();
          const projects = projectsData.data || [];
          
          for (const project of projects) {
            allProjects.push({
              hubId: hub.id,
              hubName: hub.attributes.name,
              projectId: project.id,
              projectName: project.attributes.name
            });
          }
        } catch (error) {
          console.error(`Error getting projects for hub ${hub.id}:`, error);
        }
      }
      
      // Check projects (limit to avoid timeout)
      const projectsToCheck = allProjects.slice(0, 3);
      
      for (const project of projectsToCheck) {
        try {
          // Get top folders
          const foldersResponse = await fetch(
            `https://developer.api.autodesk.com/project/v1/hubs/${project.hubId}/projects/${project.projectId}/topFolders`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          const foldersData = await foldersResponse.json();
          const folders = foldersData.data || [];
          
          // Find Project Files folder
          const projectFilesFolder = folders.find(f => 
            f.attributes.name === 'Project Files' || 
            f.attributes.displayName === 'Project Files'
          );
          
          if (projectFilesFolder) {
            await findModelsInFolder(token, projectFilesFolder, project, "3. MODELS", modelsFound);
          }
        } catch (error) {
          console.error(`Error checking project ${project.projectId}:`, error);
        }
      }
      
      res.json({
        hubs: hubs.map(h => ({
          id: h.id,
          name: h.attributes.name
        })),
        projects: allProjects,
        models: modelsFound
      });
      
    } catch (error) {
      console.error('Error finding models:', error);
      res.status(500).json({
        error: error.message
      });
    }
  });
  
  // Helper function to recursively find models in folders
  async function findModelsInFolder(token, folder, project, targetFolderName, modelsFound, depth = 0) {
    if (depth > 5) return; // Prevent infinite recursion
    
    try {
      // Get contents of folder
      const contentsResponse = await fetch(
        folder.relationships.contents.links.related.href,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const contentsData = await contentsResponse.json();
      const items = contentsData.data || [];
      
      // Check if this is the target models folder or a subfolder to search
      if (folder.attributes.name === targetFolderName || 
          folder.attributes.displayName === targetFolderName) {
        console.log(`Found models folder: ${folder.attributes.name}`);
        
        // Process items in this folder
        await processItemsForModels(token, items, project, modelsFound);
        
        // Also search all subfolders
        const subfolders = items.filter(item => item.type === 'folders');
        for (const subfolder of subfolders) {
          await findModelsInFolder(token, subfolder, project, null, modelsFound, depth + 1);
        }
      } else {
        // Look for target folder in subfolders
        const subfolders = items.filter(item => item.type === 'folders');
        for (const subfolder of subfolders) {
          if (targetFolderName && 
              (subfolder.attributes.name === targetFolderName || 
               subfolder.attributes.displayName === targetFolderName)) {
            await findModelsInFolder(token, subfolder, project, null, modelsFound, depth + 1);
          } else if (!targetFolderName) {
            // If we've already found the models folder, keep searching all subfolders
            await processItemsForModels(token, items, project, modelsFound);
            await findModelsInFolder(token, subfolder, project, null, modelsFound, depth + 1);
          } else {
            // Keep looking for the target folder
            await findModelsInFolder(token, subfolder, project, targetFolderName, modelsFound, depth + 1);
          }
        }
      }
    } catch (error) {
      console.error(`Error checking folder contents:`, error);
    }
  }
  
  // Helper function to process items for models
  async function processItemsForModels(token, items, project, modelsFound) {
    const modelItems = items.filter(item => item.type === 'items');
    
    // Get versions for up to 5 items
    for (const item of modelItems.slice(0, 5)) {
      try {
        const versionsResponse = await fetch(
          item.relationships.versions.links.related.href,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        const versionsData = await versionsResponse.json();
        const versions = versionsData.data || [];
        
        if (versions.length > 0) {
          const latestVersion = versions[0];
          
          // Check if has derivatives
          if (latestVersion.relationships && 
              latestVersion.relationships.derivatives && 
              latestVersion.relationships.derivatives.data) {
            
            const urn = latestVersion.relationships.derivatives.data.id;
            
            modelsFound.push({
              projectName: project.projectName,
              name: item.attributes.displayName || item.attributes.name,
              urn: urn,
              type: item.attributes.extension
            });
          }
        }
      } catch (error) {
        console.error(`Error getting versions for item:`, error);
      }
    }
  }

  // Add this endpoint to your server.js
app.post('/api/translate-model/:urn', async (req, res) => {
    try {
      const { urn } = req.params;
      const token = await getForgeToken();
      
      // First check if it's already translated
      const manifestResponse = await fetch(
        `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
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
  });
  
  // Also add an endpoint to check translation status
  app.get('/api/translation-status/:urn', async (req, res) => {
    try {
      const { urn } = req.params;
      const token = await getForgeToken();
      
      const manifestResponse = await fetch(
        `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (manifestResponse.status === 404) {
        return res.status(404).json({
          status: 'not_found',
          message: 'This model has not been translated'
        });
      }
      
      if (!manifestResponse.ok) {
        const errorText = await manifestResponse.text();
        return res.status(manifestResponse.status).json({
          status: 'error',
          message: errorText
        });
      }
      
      const manifestData = await manifestResponse.json();
      
      res.json({
        status: 'success',
        translation_status: manifestData.status,
        progress: manifestData.progress,
        manifest: manifestData
      });
      
    } catch (error) {
      console.error('Error checking translation status:', error);
      res.status(500).json({
        status: 'error',
        error: error.message
      });
    }
  });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});