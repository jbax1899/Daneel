// Minimal type definitions for @modelcontextprotocol/sdk
declare module '@modelcontextprotocol/sdk' {
  // Define the Server class
  export class Server {
    constructor(options: {
      name: string;
      version: string;
      tools: Array<{
        name: string;
        description: string;
        inputSchema: any;
      }>;
      handleToolCall: (toolName: string, args: any) => Promise<any>;
    });
    
    connect(transport: any): void;
  }

  // Define the stdioServerTransport function
  export function stdioServerTransport(): any;
  
  // For default import
  const _default: {
    Server: typeof Server;
    stdioServerTransport: typeof stdioServerTransport;
  };
  
  export default _default;
}
