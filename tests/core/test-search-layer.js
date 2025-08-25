import '../../tests/testSetup.js';
/**
 * Search Layer Testing Script
 * 
 * This script demonstrates and tests the complete search functionality
 * including both basic and advanced search capabilities.
 */

async function testSearchLayer() {
    console.log('🔍 Testing Search Layer Implementation...\n');

    // Mock user token for testing
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
    const baseUrl = 'https://your-worker.domain.workers.dev';

    console.log('📚 Available Search Endpoints:');
    console.log('==============================');
    console.log('1. GET  /search                - Basic search');
    console.log('2. POST /search/advanced       - Advanced search with filters');
    console.log('');

    // Test Case 1: Basic Search
    console.log('🔍 Test 1: Basic Search');
    console.log('========================');
    
    const basicSearchUrl = `${baseUrl}/search?q=contract&engine=all&limit=10`;
    console.log(`URL: ${basicSearchUrl}`);
    console.log('Headers:');
    console.log(`  Authorization: Bearer ${mockToken}`);
    
    console.log('\nExpected Response:');
    console.log(JSON.stringify({
        query: "contract",
        engine: "all",
        results: [
            {
                id: "file-123",
                title: "Service Agreement", 
                summary: "Professional services contract between...",
                entities: ["ACME Corp", "John Smith", "New York"],
                topics: ["contracts", "legal", "services"],
                userId: "user-456",
                filename: "service-agreement.pdf",
                mimeType: "application/pdf",
                uploadedAt: "2025-01-15T10:30:00Z",
                lastAnalyzed: "2025-01-15T10:35:00Z"
            }
        ],
        total: 15
    }, null, 2));

    // Test Case 2: Advanced Search
    console.log('🔍 Test 2: Advanced Search');
    console.log('===========================');
    
    const advancedSearchUrl = `${baseUrl}/search/advanced`;
    console.log(`URL: ${advancedSearchUrl}`);
    console.log('Headers:');
    console.log(`  Authorization: Bearer ${mockToken}`);
    console.log('Body:');
    console.log(JSON.stringify({
        query: "contract",
        filters: {
            entities: ["ACME Corp"],
            topics: ["legal"],
            dateRange: {
                from: "2025-01-01",
                to: "2025-12-31"
            }
        },
        sort: {
            field: "uploadedAt",
            order: "desc"
        },
        limit: 5
    }, null, 2));
    
    console.log('\nExpected Response:');
    console.log(JSON.stringify({
        query: "contract",
        filters: {
            entities: ["ACME Corp"],
            topics: ["legal"],
            dateRange: {
                from: "2025-01-01",
                to: "2025-12-31"
            }
        },
        sort: {
            field: "uploadedAt",
            order: "desc"
        },
        results: [
            {
                id: "file-456",
                title: "Contract with ACME Corp", 
                summary: "Detailed contract with ACME Corporation...",
                entities: ["ACME Corp"],
                topics: ["contracts", "legal"],
                userId: "user-789",
                filename: "contract-acme.pdf",
                mimeType: "application/pdf",
                uploadedAt: "2025-06-10T14:20:00Z",
                lastAnalyzed: "2025-06-10T14:25:00Z"
            }
        ],
        total: 1
    }, null, 2));

    // Test Case 3: Error Handling - Invalid Token
    console.log('❌ Test 3: Error Handling - Invalid Token');
    console.log('=========================================');
    
    const invalidToken = 'invalid-token';
    const errorUrl = `${baseUrl}/search?q=contract&engine=all&limit=10`;
    console.log(`URL: ${errorUrl}`);
    console.log('Headers:');
    console.log(`  Authorization: Bearer ${invalidToken}`);
    
    console.log('\nExpected Response:');
    console.log(JSON.stringify({
        error: "Unauthorized",
        message: "Invalid or expired token."
    }, null, 2));

    // Test Case 4: Error Handling - Missing Query Parameter
    console.log('❌ Test 4: Error Handling - Missing Query Parameter');
    console.log('=================================================');
    
    const missingQueryUrl = `${baseUrl}/search?engine=all&limit=10`;
    console.log(`URL: ${missingQueryUrl}`);
    console.log('Headers:');
    console.log(`  Authorization: Bearer ${mockToken}`);
    
    console.log('\nExpected Response:');
    console.log(JSON.stringify({
        error: "Bad Request",
        message: "Missing required query parameter: q"
    }, null, 2));
}

testSearchLayer().catch(console.error);
