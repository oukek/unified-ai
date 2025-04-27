import { AIService } from '../services/AIService';
import { ConversationRepository } from '../repositories/ConversationRepository';
import { ChatMessageRepository } from '../repositories/ChatMessageRepository';
import { ChatMessage } from '../entities/ChatMessage';
import { Response } from 'express';

export class AIController {
  private aiService: AIService;
  private conversationRepository: ConversationRepository;
  private messageRepository: ChatMessageRepository;

  constructor() {
    this.aiService = new AIService();
    this.conversationRepository = new ConversationRepository();
    this.messageRepository = new ChatMessageRepository();
  }

  /**
   * 流式发送消息到AI（通过WebSocket处理）
   */
  async handleStreamMessage(
    userId: string,
    conversationId: string,
    content: string,
    socketCallback: (eventType: string, data: any) => void,
  ): Promise<any> {
    try {
      // 获取会话信息
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new Error('会话不存在');
      }

      // 检查会话所有权
      if (conversation.userId !== userId) {
        throw new Error('无权访问该会话');
      }

      // 获取会话历史记录
      const messages = await this.messageRepository.findByConversationId(conversationId);
      const history = messages.map(msg => ({
        role: msg.role,
        content: msg?.blocks?.map(block => {
          if (block.type === 'text') {
            return typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
          } else if (block.type === 'tool') {
            return JSON.stringify(block.data.result)
          }
        }).join('\n') || msg.content
      }));

      // 添加用户消息
      const userMessage = new ChatMessage();
      userMessage.conversationId = conversationId;
      userMessage.content = content;
      userMessage.role = 'user';
      const savedUserMessage = await this.messageRepository.create(userMessage);

      // 创建AI消息占位
      const assistantMessage = new ChatMessage();
      assistantMessage.conversationId = conversationId;
      assistantMessage.content = '';
      assistantMessage.role = 'assistant';
      assistantMessage.blocks = [];
      const savedAssistantMessage = await this.messageRepository.create(assistantMessage);

      // 响应的内容和块
      let fullContent = '';
      const contentBlocks: any[] = [];
      
      // 创建一个文本块的工具函数
      const addTextBlock = (text: string) => {
        if (!text) return;
        
        // 如果最后一个块是文本块，则追加内容
        const lastBlock = contentBlocks[contentBlocks.length - 1];
        if (lastBlock && lastBlock.type === 'text') {
          lastBlock.content += text;
        } else {
          // 否则创建新的文本块
          contentBlocks.push({
            type: 'text',
            content: text
          });
        }
      };

      // 定义回调函数，将实时更新发送到客户端
      const aiCallback = async (eventType: string, data: any) => {
        // 转发事件到WebSocket客户端
        socketCallback(eventType, {
          ...data,
          messageId: savedAssistantMessage.id
        });
        
        // 同时处理内容更新
        if (eventType === 'responseChunk' && data.chunk && data.chunk.content) {
          fullContent += data.chunk.content;
          addTextBlock(data.chunk.content);
        } else if (eventType === 'functionCallStart' && data.functionCalls && data.functionCalls.length > 0) {
          for (const call of data.functionCalls) {
            contentBlocks.push({
              type: 'tool',
              data: call
            });
          }
        } else if (eventType === 'functionCallEnd' && data.functionCalls && data.functionCalls.length > 0) {
          // 查找并更新对应的函数调用结果
          for (const call of data.functionCalls) {
            const blockIndex = contentBlocks.findIndex(
              block => block.type === 'tool' && block.data?.id === call.id
            );
            if (blockIndex !== -1) {
              contentBlocks[blockIndex].data = call;
            }
          }
        }
      };

      // 发送流式请求到AI
      await this.aiService.sendMessageStream(
        userId,
        content,
        history,
        conversation.systemMessage || undefined,
        aiCallback,
      );

      // 流处理完成后，更新最终消息
      await this.messageRepository.update(savedAssistantMessage.id, {
        content: fullContent,
        blocks: contentBlocks.length > 0 ? contentBlocks : undefined,
        functionCalls: contentBlocks
          .filter(block => block.type === 'tool' && block.data)
          .map(block => block.data)
      });
      
      // 更新会话的更新时间
      await this.conversationRepository.update(conversationId, {
        updatedAt: new Date()
      });
      
      // 如果是第一条消息，更新会话标题
      if (messages.length === 0) {
        try {
          const title = await this.aiService.generateTitle(
            userId,
            content,
            fullContent
          );
          
          await this.conversationRepository.update(conversationId, {
            title: title || '新会话'
          });
        } catch (error) {
          console.error('生成标题失败:', error);
        }
      }

      return {
        userMessage: savedUserMessage,
        assistantMessage: {
          ...savedAssistantMessage,
          content: fullContent, 
          blocks: contentBlocks.length > 0 ? contentBlocks : undefined,
          functionCalls: contentBlocks
            .filter(block => block.type === 'tool' && block.data)
            .map(block => block.data)
        }
      };
    } catch (error) {
      console.error('AI流式处理消息失败:', error);
      throw error;
    }
  }

  /**
   * 通过SSE流式发送消息到AI
   */
  async handleStreamMessageSSE(
    userId: string,
    conversationId: string,
    content: string,
    res: Response,
  ): Promise<void> {
    try {
      // 创建一个适配器函数，将socketCallback转换为SSE发送
      const sseCallback = (eventType: string, data: any) => {
        // 将数据转换为SSE格式并发送
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        
        // 如果客户端断开连接，我们需要处理
        if (res.writableEnded) {
          return;
        }
      };

      // 调用现有的handleStreamMessage方法
      const result = await this.handleStreamMessage(
        userId,
        conversationId,
        content,
        sseCallback
      );

      // 发送完成事件
      res.write(`event: complete\n`);
      res.write(`data: ${JSON.stringify({ 
        messageId: result.assistantMessage.id,
        content: result.assistantMessage.content,
        blocks: result.assistantMessage.blocks,
        functionCalls: result.assistantMessage.functionCalls
      })}\n\n`);

      // 结束响应
      res.end();
    } catch (error) {
      console.error('AI SSE流式处理消息失败:', error);
      
      // 如果还没有发送响应，则发送错误
      if (!res.headersSent) {
        res.status(500).json({ error: '处理消息失败' });
      } else {
        // 如果已经开始SSE流，则发送错误事件
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: '处理消息失败' })}\n\n`);
        res.end();
      }
    }
  }
} 