// public/js/ElementFinderExtension.js

class ElementFinderExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this.viewer = viewer;
        this.options = options;
        this.searchTerm = options.searchTerm || '';
        this.propertyDatabase = null;
        this.foundIds = [];
        this.debugMode = true; // Set to true to see detailed logs
    }

    load() {
        this.log('ElementFinderExtension loaded');
        
        // When search term is provided, start search after model is fully loaded
        if (this.searchTerm) {
            this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                // Give the property database time to initialize
                setTimeout(() => {
                    this.findElementByName(this.searchTerm);
                }, 1500);
            });
        }
        
        return true;
    }

    unload() {
        this.log('ElementFinderExtension unloaded');
        return true;
    }
    
    // Helper for conditional logging
    log(message, type) {
        if (this.debugMode) {
            console.log(`[ElementFinder] ${message}`);
        }
    }

    // Search for an element by name or partial name match
    async findElementByName(searchTerm) {
        this.log(`Searching for element containing: "${searchTerm}"`);
        
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
            
            // Try deep tree search first (most thorough)
            await this.deepInstanceTreeSearch(searchTerm);
            
            // If no results, try with property search
            if (this.foundIds.length === 0) {
                await this.searchWithPropertyDatabase(searchTerm);
            }
            
            // If still no results, try substring matching
            if (this.foundIds.length === 0) {
                // Remove brackets and try again
                const cleanTerm = searchTerm.replace(/\[.*?\]/g, '').trim();
                if (cleanTerm !== searchTerm) {
                    this.log(`Trying again with cleaned term: "${cleanTerm}"`);
                    await this.deepInstanceTreeSearch(cleanTerm);
                }
            }
            
            // If we found matching elements, highlight them
            if (this.foundIds.length > 0) {
                this.highlightElements(this.foundIds);
            } else {
                this.log(`No elements found matching: "${searchTerm}"`);
                console.warn(`No elements found matching: "${searchTerm}"`);
            }
        } catch (error) {
            console.error('Error searching for element:', error);
        }
    }
    
    // Deep recursive search through the instance tree
    async deepInstanceTreeSearch(searchTerm) {
        return new Promise((resolve) => {
            const model = this.viewer.model;
            const instanceTree = model.getInstanceTree();
            
            if (!instanceTree) {
                this.log('Instance tree not available');
                resolve();
                return;
            }
            
            const searchLower = searchTerm.toLowerCase();
            
            // Queue for breadth-first traversal
            const queue = [];
            const processed = new Set();
            
            // Start with root node
            const rootId = instanceTree.getRootId();
            queue.push(rootId);
            processed.add(rootId);
            
            // Process all nodes in breadth-first order
            const processQueue = () => {
                if (queue.length === 0) {
                    this.log(`Deep search complete, found ${this.foundIds.length} matches`);
                    resolve();
                    return;
                }
                
                // Process a batch of nodes
                const batchSize = Math.min(20, queue.length);
                const batch = queue.splice(0, batchSize);
                let completedCount = 0;
                
                batch.forEach(dbId => {
                    // Get node properties
                    model.getProperties(dbId, (props) => {
                        completedCount++;
                        
                        // Check name property
                        const name = props.name || '';
                        const externalId = props.externalId || '';
                        
                        if (name.toLowerCase().includes(searchLower) || 
                            externalId.toLowerCase().includes(searchLower)) {
                            this.log(`Found match: "${name}" (dbId: ${dbId})`);
                            if (!this.foundIds.includes(dbId)) {
                                this.foundIds.push(dbId);
                            }
                        }
                        
                        // Add children to queue
                        instanceTree.enumNodeChildren(dbId, (childId) => {
                            if (!processed.has(childId)) {
                                queue.push(childId);
                                processed.add(childId);
                            }
                        });
                        
                        // Continue processing queue when batch is done
                        if (completedCount === batch.length) {
                            setTimeout(processQueue, 0);
                        }
                    });
                });
            };
            
            // Start processing
            processQueue();
        });
    }
    
    // Method 2: Search using the property database
    async searchWithPropertyDatabase(searchTerm) {
        return new Promise((resolve) => {
            // Try a more aggressive search
            this.viewer.search(searchTerm, (dbIds) => {
                if (dbIds && dbIds.length > 0) {
                    this.log(`Found ${dbIds.length} elements with property search`);
                    dbIds.forEach(id => {
                        if (!this.foundIds.includes(id)) {
                            this.foundIds.push(id);
                        }
                    });
                }
                resolve();
            });
        });
    }

    // Update ElementFinderExtension.js to add PTP Assembly Name highlighting

    // Add this method to the ElementFinderExtension class
    async findElementsByPTPAssemblyName(assemblyName) {
        this.log(`Searching for elements with PTP_Assembly_Name: "${assemblyName}"`);
        
        const model = this.viewer.model;
        if (!model) {
        console.error('Model not available');
        return;
        }
        
        this.foundIds = [];
        
        try {
        // Get all elements in the model
        const instanceTree = model.getInstanceTree();
        if (!instanceTree) {
            this.log('Instance tree not available');
            return;
        }
        
        // Track processed nodes to avoid duplicates
        const processed = new Set();
        
        // Process each node to check PTP_Assembly_Name property
        const checkNode = (dbId) => {
            return new Promise((resolve) => {
            if (processed.has(dbId)) {
                resolve();
                return;
            }
            
            processed.add(dbId);
            
            model.getProperties(dbId, (props) => {
                // Check all properties for PTP_Assembly_Name
                if (props.properties) {
                const ptpAssemblyProp = props.properties.find(p => 
                    p.displayName === 'PTP_Assembly_Name' || 
                    p.displayName === 'PTP Assembly Name' ||
                    p.displayName === 'PTPAssemblyName');
                    
                if (ptpAssemblyProp && ptpAssemblyProp.displayValue === assemblyName) {
                    this.log(`Found matching element with dbId: ${dbId}, name: ${props.name || 'unnamed'}`);
                    this.foundIds.push(dbId);
                }
                }
                resolve();
            });
            });
        };
        
        // Use a queue for breadth-first traversal
        const queue = [];
        
        // Start with root node
        const rootId = instanceTree.getRootId();
        
        // Enumerate all nodes starting from root
        const allDbIds = [];
        instanceTree.enumNodeChildren(rootId, (dbId) => {
            allDbIds.push(dbId);
            
            // Also get children of this node
            instanceTree.enumNodeChildren(dbId, (childId) => {
            if (!allDbIds.includes(childId)) {
                allDbIds.push(childId);
            }
            });
        });
        
        this.log(`Checking ${allDbIds.length} elements for PTP_Assembly_Name...`);
        
        // Process in batches to avoid performance issues
        const batchSize = 50;
        for (let i = 0; i < allDbIds.length; i += batchSize) {
            const batch = allDbIds.slice(i, i + batchSize);
            await Promise.all(batch.map(dbId => checkNode(dbId)));
            
            // If we already found some matches, no need to process all elements
            if (this.foundIds.length > 0 && i >= 500) {
            this.log(`Found ${this.foundIds.length} matches, stopping further search.`);
            break;
            }
        }
        
        this.log(`Found ${this.foundIds.length} elements with PTP_Assembly_Name: "${assemblyName}"`);
        
        if (this.foundIds.length > 0) {
            this.highlightElements(this.foundIds);
        } else {
            this.log(`No elements found with PTP_Assembly_Name: "${assemblyName}"`);
        }
        } catch (error) {
        console.error('Error searching for PTP_Assembly_Name:', error);
        }
    }
    
    // Highlight the found elements
    highlightElements(dbIds) {
        if (!dbIds || dbIds.length === 0) return;
        
        this.log(`Highlighting ${dbIds.length} elements`);
        
        // Clear any current selection
        this.viewer.clearSelection();
        
        // Select the elements
        this.viewer.select(dbIds);
        
        // Zoom to the elements
        this.viewer.fitToView(dbIds);
        
        // Apply custom highlighting
        this.applyCustomHighlighting(dbIds);
        
        // Provide additional information in the UI
        this.showElementInfo(dbIds);
    }
    
    // Apply custom visual highlighting
    applyCustomHighlighting(dbIds) {
        const model = this.viewer.model;
        
        // Apply custom color to make the highlight more visible
        const highlightColor = new THREE.Vector4(1, 0.5, 0, 0.7); // Orange with alpha
        
        dbIds.forEach(dbId => {
            this.viewer.setThemingColor(dbId, highlightColor);
        });
    }
    
    // Show information about the highlighted element
    showElementInfo(dbIds) {
        if (dbIds.length === 0) return;
        
        const model = this.viewer.model;
        const dbId = dbIds[0]; // Show info for the first element if multiple
        
        // Get properties for display
        model.getProperties(dbId, (props) => {
            this.log(`Element details for dbId ${dbId}:`);
            this.log(`- Name: ${props.name || 'N/A'}`);
            this.log(`- Category: ${props.category || 'N/A'}`);
            this.log(`- External ID: ${props.externalId || 'N/A'}`);
            
            // Display information in a panel if desired
            // This is optional and can be expanded
            const modelInfoElement = document.getElementById('model-info');
            if (modelInfoElement) {
                modelInfoElement.innerHTML = `
                    <div>
                        <strong>Selected Element:</strong> ${props.name || 'Unknown'}
                        <br>
                        <strong>ID:</strong> ${dbId}
                    </div>
                `;
            }
        });
    }
}

// Auto-register the extension
Autodesk.Viewing.theExtensionManager.registerExtension(
    'ElementFinderExtension', 
    ElementFinderExtension
);