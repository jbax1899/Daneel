import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { Server } from '@modelcontextprotocol/sdk';

async function startServer() {
  // Load OpenAPI YAML
  const openApiPath = process.cwd() + '/mcp/openapi.documented.yaml';
  let openapiDoc: any;

  try {
    const openapiRaw = readFileSync(openApiPath, 'utf8');
    openapiDoc = load(openapiRaw);
  } catch (error) {
    console.error(`Error loading OpenAPI document from ${openApiPath}:`, error);
    process.exit(1);
  }

  // Extract endpoints (simplified)
  const endpoints = Object.entries(openapiDoc.paths || {}).flatMap(
    ([path, methods]: [string, any]) =>
      Object.entries(methods).map(([method, details]: [string, any]) => ({
        path,
        method,
        operationId: details.operationId,
        summary: details.summary,
        description: details.description,
        parameters: details.parameters || [],
        requestBody: details.requestBody,
        responses: details.responses || {}
      }))
  );

  // Create MCP tools
  const tools = [
    {
      name: 'searchOpenAIDocs',
      description: 'Search OpenAPI endpoints by keyword',
      inputSchema: {
        type: 'object',
        properties: { 
          query: { 
            type: 'string',
            description: 'Search query to find relevant API endpoints'
          }
        },
        required: ['query']
      }
    }
  ];

  // Tool handler
  const handleToolCall = async (toolName: string, args: any) => {
    console.log(`Handling tool call: ${toolName}`, args);
    const query = (args.query || '').toLowerCase();
    
    const results = endpoints.filter(ep => {
      const searchableText = [
        ep.path.toLowerCase(),
        ep.method.toLowerCase(),
        ep.summary?.toLowerCase() || '',
        ep.description?.toLowerCase() || '',
        ep.operationId?.toLowerCase() || ''
      ].join(' ');
      
      return searchableText.includes(query);
    });

    return { 
      results: results.slice(0, 20).map(ep => ({
        path: ep.path,
        method: ep.method,
        operationId: ep.operationId,
        summary: ep.summary,
        description: ep.description
      }))
    };
  };

  // Create and start the server
  const server = new Server({
    name: 'openai-docs-server',
    version: '1.0.0',
    tools,
    handleToolCall: async (toolName: string, args: any) => {
      console.log(`Handling tool call: ${toolName}`, args);
      return handleToolCall(toolName, args);
    }
  });

  console.log('OpenAI Docs Server is running...');
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});