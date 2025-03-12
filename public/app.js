document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const modelsDropdown = document.getElementById('models');
    const viewModelBtn = document.getElementById('view-model');
    const generateQrBtn = document.getElementById('generate-qr');
    const qrContainer = document.getElementById('qr-container');
    const qrImage = document.getElementById('qr-image');
    const downloadQrBtn = document.getElementById('download-qr');
    
    // Get token for Forge API
    async function getToken() {
        try {
            const response = await fetch('/api/token');
            const data = await response.json();
            return data.access_token;
        } catch (error) {
            console.error('Error getting token:', error);
            return null;
        }
    }
    
    // Fetch and populate models
    async function loadModels() {
        try {
            // Try to get token but continue with demo models if it fails
            let token;
            try {
                token = await getToken();
                if (!token) throw new Error('Failed to get access token');
            } catch (tokenError) {
                console.warn('Authentication error:', tokenError.message);
                console.warn('Falling back to demo models...');
                loadDemoModels();
                return;
            }
            
            // Function to load demo models
            function loadDemoModels() {
                // Real models from your ACC account
                const accModels = [
                    // Your actual model from ACC (with Base64 encoding)
                    { urn: 'dXJuOmFkc2sud2lwZW1lYTpmcy5maWxlOnZmLlgzWm8tRGUxVGZLRGpwek04SEZmQXc_dmVyc2lvbj00', name: 'FF - Externals (Real ACC Model)' },
                    { urn: 'dXJuOmFkc2sud2lwZW1lYTpmcy5maWxlOnZmLmhmR25yTjlmU3lLZHVnTWhpQ3pOWmc_dmVyc2lvbj00', name: 'Collins - Kilnaboy' },
                    
                    // Demo models as fallback
                    { urn: 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6bW9kZWwtMjAyMS9mb28uZHdm', name: 'Pine Timber (Demo)' },
                    { urn: 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6bW9kZWwtMjAyMS9iYXIuZHdm', name: 'Oak Timber (Demo)' },
                    { urn: 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6bW9kZWwtMjAyMS9iYXouZHdm', name: 'Maple Timber (Demo)' }
                ];
                
                accModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.urn;
                    option.textContent = model.name;
                    modelsDropdown.appendChild(option);
                    console.log('Models added to dropdown:', modelsDropdown.children.length - 1);
                });
            }
    
            // Get hubs
            let hubsData;
            try {
                const hubsResponse = await fetch(
                    'https://developer.api.autodesk.com/project/v1/hubs',
                    {
                        headers: {
                            'Authorization': 'Bearer ' + token
                        }
                    }
                );
                
                hubsData = await hubsResponse.json();
                console.log('Hubs response:', hubsData);
                
                if (!hubsData.data || hubsData.data.length === 0) {
                    console.warn('No hubs found in your account. Using demo models.');
                    loadDemoModels();
                    return;
                }
            } catch (error) {
                console.error('Error fetching hubs:', error);
                console.warn('Using demo models as fallback.');
                loadDemoModels();
                return;
            }
        } catch (error) {
            console.error('Error loading models:', error);
            alert('Failed to load models. See console for details.');
        }
        if (modelsDropdown.children.length <= 1) {
            console.warn('No models found, adding fallback demo models');
            loadDemoModels();
        }
    }
    
    // View model in viewer - improved debugging
    viewModelBtn.addEventListener('click', async () => {
        const urn = modelsDropdown.value;
        if (!urn) {
            alert('Please select a model first');
            return;
        }
        
        try {
            // Test token and URN validity first
            const tokenResponse = await fetch('/api/token');
            const tokenData = await tokenResponse.json();
            if (!tokenData.access_token) {
                throw new Error('Failed to get access token');
            }
            
            console.log('Obtained token successfully');
            console.log('Selected URN:', urn);
            
            // Test the manifest endpoint (optional but helpful for debugging)
            const testResponse = await fetch(`/api/test-urn/${urn}`);
            const testData = await testResponse.json();
            console.log('URN test response:', testData);
            
            // Now open the viewer
            window.open(`/view.html?urn=${urn}`, '_blank');
        } catch (error) {
            console.error('Error before opening viewer:', error);
            alert('Error: ' + error.message);
        }
    });
    
    // Generate QR code for model
    generateQrBtn.addEventListener('click', async () => {
        const urn = modelsDropdown.value;
        if (!urn) {
            alert('Please select a model first');
            return;
        }
        
        try {
            const response = await fetch(`/api/qrcode/${urn}`);
            const data = await response.json();
            
            qrImage.src = data.qrCode;
            qrContainer.style.display = 'block';
        } catch (error) {
            console.error('Error generating QR code:', error);
            alert('Failed to generate QR code');
        }
    });
    
    // Download QR code
    downloadQrBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = qrImage.src;
        link.download = `qrcode-${modelsDropdown.options[modelsDropdown.selectedIndex].textContent}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    
    // Initialize
    loadModels();
});

function translateModel() {
    const urn = document.getElementById('models').value;
    if (!urn) {
        alert('Please select a model first');
        return;
    }
    
    fetch('/api/translate-model/' + urn, {method: 'POST'})
        .then(response => response.json())
        .then(data => alert('Translation started: ' + JSON.stringify(data)))
        .catch(error => alert('Error: ' + error));
}