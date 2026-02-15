// ============================================
// SAGE ChatApp - REST API Helper
// Uses REST API with API key for database ops
// ============================================

class AppwriteAPI {
    static async request(method, endpoint, body = null) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
                    'X-Appwrite-Key': APPWRITE_CONFIG.apiKey
                }
            };

            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`${APPWRITE_CONFIG.endpoint}${endpoint}`, options);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(`${response.status}: ${data.message || 'Unknown error'}`);
            }

            return data;
        } catch (error) {
            console.error(`❌ API Error (${method} ${endpoint}):`, error.message);
            throw error;
        }
    }

    // Create a document
    static async createDocument(collectionId, data) {
        return this.request(
            'POST',
            `/databases/${APPWRITE_CONFIG.databaseId}/collections/${collectionId}/documents`,
            {
                documentId: 'unique()',
                ...data
            }
        );
    }

    // List documents
    static async listDocuments(collectionId, queries = []) {
        let url = `/databases/${APPWRITE_CONFIG.databaseId}/collections/${collectionId}/documents`;
        if (queries.length > 0) {
            url += '?' + queries.map(q => `queries[]=${encodeURIComponent(q)}`).join('&');
        }
        return this.request('GET', url);
    }

    // Get a document
    static async getDocument(collectionId, documentId) {
        return this.request(
            'GET',
            `/databases/${APPWRITE_CONFIG.databaseId}/collections/${collectionId}/documents/${documentId}`
        );
    }

    // Update a document
    static async updateDocument(collectionId, documentId, data) {
        return this.request(
            'PATCH',
            `/databases/${APPWRITE_CONFIG.databaseId}/collections/${collectionId}/documents/${documentId}`,
            data
        );
    }

    // Delete a document
    static async deleteDocument(collectionId, documentId) {
        return this.request(
            'DELETE',
            `/databases/${APPWRITE_CONFIG.databaseId}/collections/${collectionId}/documents/${documentId}`
        );
    }
}

// Make available globally
window.AppwriteAPI = AppwriteAPI;
