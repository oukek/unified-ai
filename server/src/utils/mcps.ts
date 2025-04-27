export interface Mcp {
  name: string;
  desc?: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// 内置的MCP列表
export const availableMcps: Mcp[] = [
  {
    name: 'context7',
    desc: 'Context7获取最新的代码示例并留档到您的LLM的上下文中。',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest']
  }
]; 