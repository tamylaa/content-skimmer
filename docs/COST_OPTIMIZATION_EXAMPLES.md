/**
 * Cost Optimization Usage Examples
 * 
 * This file demonstrates how to leverage the cost optimization features
 * in the content-skimmer for maximum efficiency and cost savings.
 */

// Example 1: Processing different types of content with cost awareness
async function processContentWithCostOptimization() {
    const contentSkimmer = new ContentSkimmer(env);
    
    // High-value document - gets full AI processing
    const contractResult = await contentSkimmer.processContent({
        content: 'This service agreement is entered into...',
        contentType: 'application/pdf',
        metadata: { 
            filename: 'service-contract.pdf',
            priority: 'high'
        }
    });
    // Expected: AI_FULL processing with comprehensive analysis
    
    // Large document - uses basic enrichment to save costs
    const largeDocResult = await contentSkimmer.processContent({
        content: largeTextContent, // 50KB+ content
        contentType: 'text/plain',
        metadata: { filename: 'large-report.txt' }
    });
    // Expected: BASIC_ENRICHMENT with regex-based analysis
    
    // Standard document - light AI processing
    const emailResult = await contentSkimmer.processContent({
        content: 'Meeting notes from today...',
        contentType: 'text/plain',
        metadata: { filename: 'meeting-notes.txt' }
    });
    // Expected: AI_LIGHT with summarization
}

// Example 2: Environment-specific cost controls
const environmentConfigs = {
    development: {
        dailyBudget: 10,      // $10/day
        tokenLimit: 2000,     // 2K tokens max
        enableCaching: true,
        defaultStrategy: 'AI_LIGHT'
    },
    
    production: {
        dailyBudget: 100,     // $100/day
        tokenLimit: 8000,     // 8K tokens max
        enableCaching: true,
        defaultStrategy: 'AI_FULL'
    },
    
    'high-volume': {
        dailyBudget: 200,     // $200/day
        tokenLimit: 4000,     // 4K tokens max
        enableCaching: true,
        defaultStrategy: 'BASIC_ENRICHMENT'
    }
};

// Example 3: Cost monitoring and reporting
async function monitorCosts() {
    const contentSkimmer = new ContentSkimmer(env);
    
    // Get current cost report
    const costReport = await contentSkimmer.getCostReport();
    
    console.log('Daily Cost Report:', {
        totalSpent: costReport.dailySpent,
        budgetRemaining: costReport.dailyBudget - costReport.dailySpent,
        filesProcessed: costReport.filesProcessed,
        averageCostPerFile: costReport.totalSpent / costReport.filesProcessed,
        cacheHitRate: costReport.cacheHits / costReport.totalRequests,
        topStrategies: costReport.strategyBreakdown
    });
    
    // Alert if approaching budget limit
    if (costReport.dailySpent > costReport.dailyBudget * 0.8) {
        console.warn('⚠️ Approaching daily budget limit!');
        // Consider switching to more conservative processing
    }
}

// Example 4: Content-based routing strategies
const contentTypeStrategies = {
    // High-value documents always get full AI processing
    'contracts': {
        keywords: ['agreement', 'contract', 'terms', 'conditions'],
        strategy: 'AI_FULL',
        reason: 'Legal document requires comprehensive analysis'
    },
    
    // Financial documents need detailed analysis
    'financial': {
        keywords: ['invoice', 'receipt', 'financial', 'budget'],
        strategy: 'AI_FULL',
        reason: 'Financial accuracy is critical'
    },
    
    // Technical docs can use light processing
    'technical': {
        keywords: ['documentation', 'readme', 'guide', 'manual'],
        strategy: 'AI_LIGHT',
        reason: 'Technical content has standard structure'
    },
    
    // Large files default to basic enrichment
    'large-files': {
        sizeThreshold: 50000, // 50KB
        strategy: 'BASIC_ENRICHMENT',
        reason: 'Large files are expensive to process with AI'
    }
};

// Example 5: Caching strategies for cost reduction
async function demonstrateCaching() {
    const contentSkimmer = new ContentSkimmer(env);
    
    // First processing - will use AI and cache result
    const result1 = await contentSkimmer.processContent({
        content: 'Quarterly financial report Q4 2024...',
        contentType: 'application/pdf',
        metadata: { filename: 'q4-report.pdf' }
    });
    // Cost: $0.08, Cache: MISS
    
    // Similar content - will use cached result
    const result2 = await contentSkimmer.processContent({
        content: 'Quarterly financial report Q3 2024...',
        contentType: 'application/pdf',
        metadata: { filename: 'q3-report.pdf' }
    });
    // Cost: $0.00, Cache: HIT (85% similarity)
    
    console.log('Cache savings:', {
        originalCost: 0.08,
        actualCost: 0.00,
        savings: '100%'
    });
}

// Example 6: Budget controls and circuit breakers
async function handleBudgetExceeded() {
    const contentSkimmer = new ContentSkimmer(env);
    
    try {
        const result = await contentSkimmer.processContent({
            content: 'Important document that needs processing...',
            contentType: 'text/plain',
            metadata: { 
                filename: 'important.txt',
                forceProcessing: false // Respect budget limits
            }
        });
        
        if (result.processingStrategy === 'BASIC_ENRICHMENT') {
            console.log('💡 Switched to basic enrichment due to budget constraints');
            console.log('Still providing value through regex-based analysis');
        }
        
    } catch (error) {
        if (error.message.includes('budget exceeded')) {
            console.log('🚫 Processing halted - daily budget exceeded');
            console.log('Consider upgrading plan or waiting for budget reset');
        }
    }
}

// Example 7: Cost-effective batch processing
async function processBatchWithCostOptimization(files) {
    const contentSkimmer = new ContentSkimmer(env);
    const results = [];
    
    // Sort files by priority and estimated cost
    const prioritizedFiles = files.sort((a, b) => {
        const aPriority = a.metadata?.priority === 'high' ? 1 : 0;
        const bPriority = b.metadata?.priority === 'high' ? 1 : 0;
        return bPriority - aPriority; // High priority first
    });
    
    for (const file of prioritizedFiles) {
        // Check budget before processing each file
        const costReport = await contentSkimmer.getCostReport();
        if (costReport.dailySpent >= costReport.dailyBudget) {
            console.log('Budget exceeded, switching to basic enrichment for remaining files');
            break;
        }
        
        const result = await contentSkimmer.processContent(file);
        results.push(result);
        
        // Log cost per file
        console.log(`Processed ${file.metadata.filename}: $${result.cost}`);
    }
    
    return results;
}

export {
    processContentWithCostOptimization,
    environmentConfigs,
    monitorCosts,
    contentTypeStrategies,
    demonstrateCaching,
    handleBudgetExceeded,
    processBatchWithCostOptimization
};
