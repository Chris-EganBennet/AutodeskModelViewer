// Create this file as direct-model.js
const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

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
          scope: 'data:read viewables:read'
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

// Function to check if a URN is valid
async function checkUrnValidity(token, urn) {
  try {
    const response = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const data = await response.json();
    console.log(`URN ${urn} check:`, data);
    
    if (data.status === 'success') {
      return { valid: true, data };
    } else {
      return { valid: false, reason: data };
    }
  } catch (error) {
    console.error(`Error checking URN ${urn}:`, error);
    return { valid: false, reason: error.message };
  }
}

// Main function
async function main() {
  try {
    const token = await getForgeToken();
    
    console.log('\nTo use direct model access, you need to know your model URN.');
    console.log('Here are common ways to find it:');
    console.log('1. Look at the URL when viewing a model in ACC - it often contains IDs');
    console.log('2. Use the Forge API Reference for Model Derivative to check a specific URN');
    
    // This is a placeholder - replace with actual URN if you have one
    const testUrn = 'REPLACE_WITH_YOUR_ACTUAL_URN_IF_YOU_HAVE_ONE';
    
    if (testUrn !== 'REPLACE_WITH_YOUR_ACTUAL_URN_IF_YOU_HAVE_ONE') {
      console.log(`\nChecking URN: ${testUrn}`);
      const result = await checkUrnValidity(token, testUrn);
      
      if (result.valid) {
        console.log(`✅ URN is valid! You can use this in your app.`);
        console.log(`MODEL INFO: { urn: '${testUrn}', name: 'Your Model Name' }`);
      } else {
        console.log(`❌ URN appears to be invalid or inaccessible.`);
        console.log(result.reason);
      }
    }
    
    console.log('\n📌 INSTRUCTIONS FOR FINDING YOUR URN:');
    console.log('1. In ACC, open your model viewer');
    console.log('2. Check the URL for patterns like:');
    console.log('   - "urn=..." or "URN=..." parameter');
    console.log('   - "itemId=..." or other IDs');
    console.log('3. If you find an ID, you may need to Base64 encode it');
    console.log('4. Edit this script to replace the testUrn value and run again');
    
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

main();