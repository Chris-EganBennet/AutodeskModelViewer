// public/js/ElementPathHelper.js

class ElementPathHelper {
    constructor(viewer) {
        this.viewer = viewer;
        this.model = viewer.model;
    }
    
    /**
     * Find element by path specification
     * @param {string} path - Path in format "Parent/Child/Target" or "Generic Models/FloorSystem/A/FloorSystem [717446]/QWEB_STR_LVL-LSL [717447]"
     * @returns {Promise<number[]>} - Array of dbIds for matched elements
     */
    async findElementByPath(path) {
        console.log(`[PathHelper] Finding element by path: ${path}`);
        
        // Split the path into segments
        const pathSegments = path.split('/').map(s => s.trim()).filter(s => s.length > 0);
        
        if (pathSegments.length === 0) {
            console.warn('[PathHelper] Empty path provided');
            return [];
        }
        
        console.log(`[PathHelper] Path segments:`, pathSegments);
        
        // Get instance tree
        const instanceTree = this.model.getInstanceTree();
        if (!instanceTree) {
            console.error('[PathHelper] Instance tree not available');
            return [];
        }
        
        // Start with root node
        const rootId = instanceTree.getRootId();
        
        // Find elements matching the first segment
        const firstSegmentMatches = await this.findElementsByName(rootId, pathSegments[0]);
        console.log(`[PathHelper] Found ${firstSegmentMatches.length} matches for first segment "${pathSegments[0]}"`);
        
        if (pathSegments.length === 1) {
            return firstSegmentMatches;
        }
        
        // For each potential starting point, try to follow the path
        let currentCandidates = firstSegmentMatches;
        
        // Follow the path segment by segment
        for (let i = 1; i < pathSegments.length; i++) {
            const segment = pathSegments[i];
            const nextCandidates = [];
            
            // For each current candidate, find children matching the next segment
            for (const candidate of currentCandidates) {
                const childMatches = await this.findElementsByName(candidate, segment);
                nextCandidates.push(...childMatches);
            }
            
            if (nextCandidates.length === 0) {
                console.warn(`[PathHelper] No matches found for segment "${segment}"`);
                break;
            }
            
            console.log(`[PathHelper] Found ${nextCandidates.length} matches for segment "${segment}"`);
            currentCandidates = nextCandidates;
        }
        
        return currentCandidates;
    }
    
    /**
     * Find elements by name under a parent
     * @param {number} parentId - Parent dbId to search under
     * @param {string} name - Name or partial name to match
     * @returns {Promise<number[]>} - Array of matching dbIds
     */
    async findElementsByName(parentId, name) {
        return new Promise((resolve) => {
            const matchingIds = [];
            const nameLower = name.toLowerCase();
            const visited = new Set();
            
            // Helper to check if element name matches
            const checkElement = (dbId, callback) => {
                if (visited.has(dbId)) {
                    callback();
                    return;
                }
                
                visited.add(dbId);
                
                this.model.getProperties(dbId, (props) => {
                    const elementName = props.name || '';
                    if (elementName.toLowerCase().includes(nameLower)) {
                        matchingIds.push(dbId);
                    }
                    callback();
                });
            };
            
            // Process all children of the parent
            const processChildren = (nodeId) => {
                const childrenIds = [];
                instanceTree.enumNodeChildren(nodeId, (childId) => {
                    childrenIds.push(childId);
                });
                
                // No children, we're done
                if (childrenIds.length === 0) {
                    resolve(matchingIds);
                    return;
                }
                
                // Check each child
                let completedChecks = 0;
                childrenIds.forEach(childId => {
                    checkElement(childId, () => {
                        completedChecks++;
                        if (completedChecks === childrenIds.length) {
                            resolve(matchingIds);
                        }
                    });
                });
            };
            
            const instanceTree = this.model.getInstanceTree();
            if (!instanceTree) {
                resolve([]);
                return;
            }
            
            processChildren(parentId);
        });
    }
    
    /**
     * Get the full path to an element
     * @param {number} dbId - The element dbId
     * @returns {Promise<string>} - Full path to the element
     */
    async getElementPath(dbId) {
        return new Promise((resolve) => {
            const instanceTree = this.model.getInstanceTree();
            if (!instanceTree) {
                resolve(null);
                return;
            }
            
            const path = [];
            let currentId = dbId;
            
            const processNode = () => {
                this.model.getProperties(currentId, (props) => {
                    path.unshift(props.name || `[${currentId}]`);
                    
                    const parentId = instanceTree.getNodeParentId(currentId);
                    if (parentId !== 0 && parentId !== currentId) {
                        currentId = parentId;
                        processNode();
                    } else {
                        resolve(path.join(' / '));
                    }
                });
            };
            
            processNode();
        });
    }
}

// Make it available globally
if (typeof window !== 'undefined') {
    window.ElementPathHelper = ElementPathHelper;
}