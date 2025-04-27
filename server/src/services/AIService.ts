import { GeminiModel, UnifiedAI, ChatRole, AgentEventType } from '@oukek/unified-ai';
import { ConfigRepository } from '../repositories/ConfigRepository';
import { UserToolsRepository } from '../repositories/UserToolsRepository';
import { UserMcpRepository } from '../repositories/UserMcpRepository';
import { availableTools } from '../utils/tools';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class AIService {
  private configRepository: ConfigRepository;
  private userToolsRepository: UserToolsRepository;
  private userMcpRepository: UserMcpRepository;
  
  constructor() {
    this.configRepository = new ConfigRepository();
    this.userToolsRepository = new UserToolsRepository();
    this.userMcpRepository = new UserMcpRepository();
  }
  
  /**
   * 创建AI实例
   * @param apiKey API密钥
   */
  private createAI(apiKey: string): UnifiedAI {
    try {
      const geminiModel = new GeminiModel({
        apiKey,
      });
      return new UnifiedAI(geminiModel);
    } catch (error) {
      console.error('创建AI实例失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取用户的API密钥
   * @param userId 用户ID
   */
  private async getUserApiKey(userId: string): Promise<string> {
    const config = await this.configRepository.findByUserIdAndType(userId, 'geminiApiKey');
    if (!config || !config.value) {
      throw new Error('用户未配置Gemini API密钥');
    }
    return config.value;
  }
  
  /**
   * 获取用户MCP配置
   * @param userId 用户ID
   */
  private async getUserMcp(userId: string): Promise<{client?: Client, cleanup?: () => Promise<void>}> {
    try {
      // 获取用户MCP配置
      const userMcps = await this.userMcpRepository.findByUserId(userId);
      if (!userMcps || !userMcps.enabledMcps || userMcps.enabledMcps.length === 0) {
        console.warn(`用户未启用任何MCP`);
        return {};
      }
      
      // 获取第一个启用的MCP
      const mcpName = userMcps.enabledMcps[0];
      
      // 获取MCP配置
      const mcpConfig = userMcps.mcpConfigs?.[mcpName];
      if (!mcpConfig || !mcpConfig.command || !Array.isArray(mcpConfig.args)) {
        console.warn(`MCP配置不完整: ${mcpName}`);
        return {};
      }
      
      // 创建MCP客户端
      const mcpClient = new Client({ name: mcpName, version: '1.0.0' });
      const transport = new StdioClientTransport({
        command: mcpConfig.command,
        args: mcpConfig.args,
        env: Object.assign({}, getDefaultEnvironment(), mcpConfig.env || {})
      });
      
      // 连接到传输层
      await mcpClient.connect(transport);
      
      // 创建清理函数
      const cleanup = async () => {
        if (mcpClient) {
          await mcpClient.close();
        }
      };
      
      return { client: mcpClient, cleanup };
    } catch (error) {
      console.error(`初始化MCP客户端失败:`, error);
      return {};
    }
  }
  
  /**
   * 获取用户启用的工具
   * @param userId 用户ID
   */
  private async getUserTools(userId: string): Promise<any[]> {
    const userTools = await this.userToolsRepository.findByUserId(userId);
    if (!userTools || !userTools.enabledTools || userTools.enabledTools.length === 0) {
      return [];
    }
    // 获取工具定义并过滤已启用的
    return availableTools
      .filter(tool => userTools.enabledTools.includes(tool.name))
      .map(tool => {
        // 如果工具有配置，应用用户的工具配置
        if (tool.configRequired && userTools.toolConfigs) {
          return {
            ...tool,
            config: userTools.toolConfigs[tool.name] || {}
          };
        }
        return tool;
      });
  }
  
  /**
   * 生成会话标题
   * @param userId 用户ID
   * @param userMessage 用户消息
   * @param aiResponse AI响应
   */
  async generateTitle(userId: string, userMessage: string, aiResponse: string): Promise<string> {
    try {
      // 获取API密钥
      const apiKey = await this.getUserApiKey(userId);
      
      // 创建AI实例
      const ai = this.createAI(apiKey);
      
      // 发送请求生成标题
      const titleResponse = await ai.unifiedChat(
        `基于以下对话生成一个简短的标题（不超过15个字符），请严格返回一个简短的标题，不要返回任何其他内容：\n用户: ${userMessage}\n助手: ${aiResponse.substring(0, 100)}`
      );
      
      // @ts-ignore - 类型转换
      return titleResponse.content || '';
    } catch (error) {
      console.error('生成标题失败:', error);
      // 生成失败时使用截断的用户消息作为标题
      return userMessage.length > 15 ? `${userMessage.substring(0, 12)}...` : userMessage;
    }
  }
  
  /**
   * 使用流式响应发送消息到AI
   * @param userId 用户ID
   * @param content 用户消息内容
   * @param history 历史对话记录
   * @param systemMessage 系统消息
   * @param callback 流式回调函数
   */
  async sendMessageStream(
    userId: string,
    content: string,
    history: Array<{ role: 'user' | 'assistant', content: string }>,
    systemMessage?: string,
    callback?: (eventType: string, data: any) => void,
  ): Promise<void> {
    // MCP相关资源
    let mcpClient: Client | undefined;
    let mcpCleanup: (() => Promise<void>) | undefined;
    
    try {
      // 获取API密钥
      const apiKey = await this.getUserApiKey(userId);
      
      // 创建AI实例
      const ai = this.createAI(apiKey);
      
      // 初始化MCP客户端
      const { client, cleanup } = await this.getUserMcp(userId);
      mcpClient = client;
      mcpCleanup = cleanup;
      
      // 如果MCP客户端初始化成功，添加到AI实例
      if (mcpClient) {
        ai.useMcp(mcpClient);
      }
      
      // 获取并添加用户启用的工具
      const tools = await this.getUserTools(userId);
      if (tools.length > 0) {
        ai.addFunctions(tools);
      }
      
      // 转换历史记录格式
      const formattedHistory = history.map(msg => ({
        role: msg.role === 'user' ? ChatRole.USER : ChatRole.ASSISTANT,
        content: msg.content
      }));
      
      // 将 AgentEventType 常量映射到事件类型字符串
      const eventTypeMap = {
        [AgentEventType.RESPONSE_CHUNK]: 'responseChunk',
        [AgentEventType.FUNCTION_CALL_START]: 'functionCallStart',
        [AgentEventType.FUNCTION_CALL_END]: 'functionCallEnd'
      };
      
      // 包装回调函数，将事件类型转换为前端使用的格式
      const wrappedCallback = callback ? (eventType: string, data: any) => {
        // 转换事件类型为前端使用的字符串格式
        const mappedEventType = eventTypeMap[eventType as keyof typeof eventTypeMap] || eventType;
        callback(mappedEventType, data);
      } : undefined;
      
      // 发送流式请求到AI
      const response = await ai.unifiedChatStream(content, {
        history: formattedHistory,
        systemMessage: systemMessage || undefined
      }, wrappedCallback);
      
      // 消费流
      for await (const _ of response) {
        // 已经通过回调处理了每个块
      }
    } catch (error) {
      console.error('发送流式消息到AI失败:', error);
      throw error;
    } finally {
      // 清理MCP资源
      if (mcpCleanup) {
        try {
          await mcpCleanup();
        } catch (error) {
          console.error('清理MCP资源失败:', error);
        }
      }
    }
  }
} 