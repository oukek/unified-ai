import type { AxiosResponse } from 'axios';

// 用户相关类型
export interface User {
  id: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

// 配置相关类型
export interface Config {
  id: string;
  userId: string;
  type: string;
  value: any; // 已解析的JSON对象
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 会话相关类型
export interface Conversation {
  id: string;
  userId: string;
  title: string;
  systemMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 消息相关类型
export interface ContentBlock {
  type: 'text' | 'tool'; // 文本块或工具调用块
  content?: string; // 文本内容
  data?: any; // 工具调用数据
}

export interface FunctionCall {
  id?: string; // 用于标识和展开/折叠状态跟踪
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  blocks?: ContentBlock[];
  functionCalls?: FunctionCall[];
  timestamp: Date;
}

// 工具相关类型
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  configRequired?: {
    name: string;
    description: string;
  }[];
}

export interface UserTools {
  enabledTools: string[];
  toolConfigs: Record<string, any>;
}

// 响应类型
export type ApiResponse<T> = Promise<AxiosResponse<T>>; 