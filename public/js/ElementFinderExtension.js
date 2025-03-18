// public/js/ElementFinderExtension.js

class ElementFinderExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this.viewer = viewer;
        this.options = options;
        this.searchTerm = options.searchTerm || '';
        this.propertyDatabase = null;
        this.foundIds = [];
    }

    load() {
        console.log('ElementFinderExtension loaded');
        
        // When search term is provided, start search after model is fully loaded
        if (this.searchTerm) {
            this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                // Give the property database time to initialize
                setTimeout(() => {
                    this.findElementByName(this.searchTerm);
                }, 1000);
            });
        }
        
        return true;
    }

    unload() {
        console.log('ElementFinderExtension unloaded');
        return true;
    }

    // Search for an element by name or partial name match
    async findElementByName(searchTerm) {
        console.log(`Searching for element containing: "${searchTerm}"`);
        
        const model = this.viewer.model;
        if (!model) {
            console.error('Model not available');
            return;
        }
        
        // Use the search method based on model type
        this.foundIds = [];
        
        try {
            // First try search by exact dbId if the search term is a number
            const dbId = parseInt(searchTerm);
            if (!isNaN(dbId)) {
                this.highlightElements([dbId]);
                return;
            }
            
            // Then try with the instance tree for exact name matches
            await this.searchWithInstanceTree(searchTerm);
            
            // If no results, try with the property database for partial matches
            if (this.foundIds.length === 0) {
                await this.searchWithPropertyDatabase(searchTerm);
            }
            
            // If still no results, try a more flexible search
            if (this.foundIds.length === 0) {
                await this.searchAllProperties(searchTerm);
            }
            
            // If we found matching elements, highlight them
            if (this.foundIds.length > 0) {
                this.highlightElements(this.foundIds);
            } else {
                console.warn(`No elements found matching: "${searchTerm}"`);
            }
        } catch (error) {
            console.error('Error searching for element:', error);
        }
    }
    
    // Method 1: Search using the instance tree (faster but less flexible)
    async searchWithInstanceTree(searchTerm) {
        return new Promise((resolve) => {
            const model = this.viewer.model;
            const instanceTree = model.getInstanceTree();
            
            if (!instanceTree) {
                console.warn('Instance tree not available');
                resolve();
                return;
            }
            
            const searchLower = searchTerm.toLowerCase();
            let matchFound = false;
            
            // Process each node
            instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                model.getProperties(dbId, (result) => {
                    // Check name property
                    const name = result.name || '';
                    const nameMatches = name.toLowerCase().includes(searchLower);
                    
                    // Check external ID
                    const externalId = result.externalId || '';
                    const externalIdMatches = externalId.toLowerCase().includes(searchLower);
                    
                    if (nameMatches || externalIdMatches) {
                        console.log(`Found matching element: "${name}" (dbId: ${dbId})`);
                        this.foundIds.push(dbId);
                        matchFound = true;
                    }
                });
            });
            
            // Wait a moment for async property lookups to complete
            setTimeout(() => {
                console.log(`Found ${this.foundIds.length} elements with instance tree search`);
                resolve();
            }, 1000);
        });
    }
    
    // Method 2: Search using the property database (more thorough)
    async searchWithPropertyDatabase(searchTerm) {
        return new Promise((resolve) => {
            const model = this.viewer.model;
            
            // Search for property "Name" containing our search term
            this.viewer.search(searchTerm, (dbIds) => {
                if (dbIds && dbIds.length > 0) {
                    console.log(`Found ${dbIds.length} elements with property database search`);
                    this.foundIds = [...this.foundIds, ...dbIds];
                }
                resolve();
            }, null, ['Name']);
        });
    }
    
    // Highlight the found elements
    highlightElements(dbIds) {
        if (!dbIds || dbIds.length === 0) return;
        
        console.log(`Highlighting ${dbIds.length} elements`);
        
        // Clear any current selection
        this.viewer.clearSelection();
        
        // Select the elements
        this.viewer.select(dbIds);
        
        // Zoom to the elements
        this.viewer.fitToView(dbIds);
        
        // Optionally isolate the elements (uncomment if desired)
        // this.viewer.isolate(dbIds);
        
        // Add visual indicators
        this.applyColorToElements(dbIds);
    }
    
    // Apply color to highlight elements
    applyColorToElements(dbIds) {
        const model = this.viewer.model;
        
        // Create a custom material for highlighting
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color(1, 0.5, 0),  // Orange highlight
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        // Apply the material to elements
        for (const dbId of dbIds) {
            this.viewer.setThemingColor(dbId, new THREE.Vector4(1, 0.5, 0, 0.7));
        }
    }
    
    // Method 3: Search all properties (slowest but most thorough)
    async searchAllProperties(searchTerm) {
        return new Promise((resolve) => {
            const model = this.viewer.model;
            const searchLower = searchTerm.toLowerCase();
            let matchFound = false;
            
            // Get all leaf nodes
            const allDbIds = [];
            const instanceTree = model.getInstanceTree();
            
            if (instanceTree) {
                instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                    // Check if it's a leaf node (actual element, not a group)
                    if (instanceTree.getChildCount(dbId) === 0) {
                        allDbIds.push(dbId);
                    }
                });
            }
            
            console.log(`Checking ${allDbIds.length} elements for matches...`);
            
            // Limit the search to avoid performance issues
            const maxElements = Math.min(allDbIds.length, 1000);
            let processedCount = 0;
            
            // Process elements in smaller batches
            const batchSize = 20;
            const batches = [];
            
            for (let i = 0; i < maxElements; i += batchSize) {
                batches.push(allDbIds.slice(i, i + batchSize));
            }
            
            // Process batches sequentially to avoid overwhelming the browser
            const processBatch = (batchIndex) => {
                if (batchIndex >= batches.length) {
                    console.log(`Completed deep search. Found ${this.foundIds.length} matches`);
                    resolve();
                    return;
                }
                
                const batch = batches[batchIndex];
                let completed = 0;
                
                batch.forEach(dbId => {
                    model.getProperties(dbId, (result) => {
                        // Check each property for matches
                        if (result.properties) {
                            for (const prop of result.properties) {
                                // Check if any property value contains our search term
                                const propValue = String(prop.displayValue || prop.displayName || '');
                                if (propValue.toLowerCase().includes(searchLower)) {
                                    console.log(`Found match in dbId: ${dbId}, property: ${prop.displayName}`);
                                    if (!this.foundIds.includes(dbId)) {
                                        this.foundIds.push(dbId);
                                    }
                                    break;
                                }
                            }
                        }
                        
                        // Also check the name
                        const name = result.name || '';
                        if (name.toLowerCase().includes(searchLower) && !this.foundIds.includes(dbId)) {
                            this.foundIds.push(dbId);
                        }
                        
                        completed++;
                        if (completed === batch.length) {
                            // Process the next batch
                            processBatch(batchIndex + 1);
                        }
                    });
                });
            };
            
            // Start processing with the first batch
            processBatch(0);
        })
    }
}