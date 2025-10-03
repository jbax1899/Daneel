declare module '@modelcontextprotocol/sdk/dist/cjs/server/mcp' {
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
}

declare module '@modelcontextprotocol/sdk/dist/cjs/server/stdio' {
  export function stdioServerTransport(): any;
}
