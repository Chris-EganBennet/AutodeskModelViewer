// Create this file as acc-diagnostic.js in your project root
const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

// Display environment info
console.log('FORGE_CLIENT_ID exists:', Boolean(process.env.FORGE_CLIENT_ID));
console.log('FORGE_CLIENT_SECRET exists:', Boolean(process.env.FORGE_CLIENT_SECRET));

async function getForgeToken() {
  try {
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
          scope: 'data:read viewables:read account:read'
        })
      }
    );

    const data = await response.json();
    
    if (!data.access_token) {
      console.error('Authentication error:', data);
      throw new Error(`Authentication failed: ${JSON.stringify(data)}`);
    }
    
    console.log('✅ Authentication successful');
    return data.access_token;
  } catch (error) {
    console.error('❌ Authentication error:', error);
    throw error;
  }
}

async function findModels() {
  try {
    const token = await getForgeToken();
    
    // Skip user profile (deprecated endpoint)
    console.log('\n📋 Skipping user profile (using deprecated endpoint)');
    
    // 2. Get hubs (BIM 360/ACC Teams)
    console.log('\n📋 Fetching hubs...');
    const hubsResponse = await fetch(
      'https://developer.api.autodesk.com/project/v1/hubs',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const hubsData = await hubsResponse.json();
    
    if (!hubsData.data || hubsData.data.length === 0) {
      console.log('❌ No hubs found. You need access to BIM 360 or ACC.');
      return;
    }
    
    console.log(`Found ${hubsData.data.length} hubs:`);
    
    // 3. Examine each hub
    for (const hub of hubsData.data) {
      console.log(`\n📂 Hub: ${hub.attributes.name} (${hub.id})`);
      
      // 4. Get projects
      const projectsResponse = await fetch(
        `https://developer.api.autodesk.com/project/v1/hubs/${hub.id}/projects`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const projectsData = await projectsResponse.json();
      
      if (!projectsData.data || projectsData.data.length === 0) {
        console.log('   ❌ No projects found in this hub');
        continue;
      }
      
      console.log(`   Found ${projectsData.data.length} projects:`);
      
      // 5. Examine each project
      for (const project of projectsData.data) {
        console.log(`\n   📂 Project: ${project.attributes.name} (${project.id})`);
        
        // 6. Get top folders
        const foldersResponse = await fetch(
          `https://developer.api.autodesk.com/project/v1/hubs/${hub.id}/projects/${project.id}/topFolders`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        const foldersData = await foldersResponse.json();
        
        if (!foldersData.data || foldersData.data.length === 0) {
          console.log('      ❌ No folders found in this project');
          continue;
        }
        
        // 7. Find the Models folder specifically
        const modelsFolder = foldersData.data.find(folder => 
          folder.attributes.name === 'Models' || 
          folder.attributes.name === 'Project Files'
        );
        
        if (!modelsFolder) {
          console.log('      ❌ Models folder not found');
          continue;
        }
        
        console.log(`      📂 Models folder: ${modelsFolder.attributes.name} (${modelsFolder.id})`);
        
        // 8. Get items in the Models folder
        const folderUrl = modelsFolder.relationships.contents.links.related.href;
        const contentsResponse = await fetch(
          folderUrl,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        const contentsData = await contentsResponse.json();
        
        if (!contentsData.data || contentsData.data.length === 0) {
          console.log('         ❌ No items found in Models folder');
          continue;
        }
        
        // 9. Filter for model items
        const modelItems = contentsData.data.filter(item => item.type === 'items');
        
        if (modelItems.length === 0) {
          console.log('         ❌ No model items found');
          continue;
        }
        
        console.log(`         Found ${modelItems.length} model items:`);
        
        // 10. Examine a few model items (up to 3)
        const itemsToExamine = modelItems.slice(0, 3);
        
        for (const item of itemsToExamine) {
          console.log(`\n         🗂️ Model: ${item.attributes.displayName || item.attributes.name} (${item.id})`);
          console.log(`            Extension: ${item.attributes.extension}`);
          
          if (!item.relationships || !item.relationships.versions) {
            console.log('            ❌ No versions available');
            continue;
          }
          
          // 11. Get versions
          const versionsUrl = item.relationships.versions.links.related.href;
          const versionsResponse = await fetch(
            versionsUrl,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          const versionsData = await versionsResponse.json();
          
          if (!versionsData.data || versionsData.data.length === 0) {
            console.log('            ❌ No versions found');
            continue;
          }
          
          console.log(`            Found ${versionsData.data.length} versions`);
          
          // 12. Get the latest version
          const latestVersion = versionsData.data[0];
          
          console.log(`            Latest version: ${latestVersion.id}`);
          
          // 13. Check for derivatives (viewable)
          if (latestVersion.relationships && 
              latestVersion.relationships.derivatives && 
              latestVersion.relationships.derivatives.data) {
            
            const derivativeUrn = latestVersion.relationships.derivatives.data.id;
            console.log(`            ✅ URN: ${derivativeUrn}`);
            console.log(`            MODEL INFO: { urn: '${derivativeUrn}', name: '${item.attributes.displayName || item.attributes.name}' }`);
          } else {
            console.log('            ❌ No derivatives/viewable available');
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error finding models:', error);
  }
}

// Run the diagnostic
findModels().then(() => {
  console.log('\nDiagnostic complete. Use the MODEL INFO entries to populate your app.');
});