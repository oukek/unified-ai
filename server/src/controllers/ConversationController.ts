import { Request, Response } from 'express';
import { ConversationRepository } from '../repositories/ConversationRepository';
import { ChatMessageRepository } from '../repositories/ChatMessageRepository';
import { ChatMessage, ContentBlock, FunctionCall } from '../entities/ChatMessage';

export class ConversationController {
  private conversationRepository: ConversationRepository;
  private messageRepository: ChatMessageRepository;

  constructor() {
    this.conversationRepository = new ConversationRepository();
    this.messageRepository = new ChatMessageRepository();
  }

  // 获取用户的所有会话
  getUserConversations = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const conversations = await this.conversationRepository.findByUserId(req.user.id);
      res.json(conversations);
    } catch (error) {
      console.error('获取用户会话失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 获取单个会话详情，包括消息
  getConversationDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { id } = req.params;
      const conversation = await this.conversationRepository.findById(id);

      if (!conversation) {
        res.status(404).json({ message: '会话不存在' });
        return;
      }

      // 验证该会话是否属于当前用户
      if (conversation.userId !== req.user.id) {
        res.status(403).json({ message: '无权访问该会话' });
        return;
      }

      // 获取会话的所有消息
      const messages = await this.messageRepository.findByConversationId(id);

      res.json({
        ...conversation,
        messages
      });
    } catch (error) {
      console.error('获取会话详情失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 创建新会话
  createConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { title, systemMessage } = req.body;

      const conversation = await this.conversationRepository.create({
        userId: req.user.id,
        title: title || '新会话',
        systemMessage: systemMessage || null
      });

      res.status(201).json(conversation);
    } catch (error) {
      console.error('创建会话失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 更新会话信息
  updateConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { id } = req.params;
      const { title, systemMessage } = req.body;

      const conversation = await this.conversationRepository.findById(id);

      if (!conversation) {
        res.status(404).json({ message: '会话不存在' });
        return;
      }

      // 验证该会话是否属于当前用户
      if (conversation.userId !== req.user.id) {
        res.status(403).json({ message: '无权修改该会话' });
        return;
      }

      const updatedConversation = await this.conversationRepository.update(id, {
        title: title !== undefined ? title : conversation.title,
        systemMessage: systemMessage !== undefined ? systemMessage : conversation.systemMessage
      });

      res.json(updatedConversation);
    } catch (error) {
      console.error('更新会话失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 删除会话及其所有消息
  deleteConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { id } = req.params;
      const conversation = await this.conversationRepository.findById(id);

      if (!conversation) {
        res.status(404).json({ message: '会话不存在' });
        return;
      }

      // 验证该会话是否属于当前用户
      if (conversation.userId !== req.user.id) {
        res.status(403).json({ message: '无权删除该会话' });
        return;
      }

      // 删除该会话下的所有消息
      await this.messageRepository.deleteByConversationId(id);
      
      // 删除会话
      await this.conversationRepository.delete(id);

      res.json({ message: '会话删除成功' });
    } catch (error) {
      console.error('删除会话失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 添加消息到会话中
  addMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { conversationId } = req.params;
      const { content, role, blocks, functionCalls } = req.body;

      const conversation = await this.conversationRepository.findById(conversationId);

      if (!conversation) {
        res.status(404).json({ message: '会话不存在' });
        return;
      }

      // 验证该会话是否属于当前用户
      if (conversation.userId !== req.user.id) {
        res.status(403).json({ message: '无权向该会话添加消息' });
        return;
      }

      if (!content || !role || !['user', 'assistant'].includes(role)) {
        res.status(400).json({ message: '消息内容或角色不合法' });
        return;
      }

      const message = new ChatMessage();
      message.conversationId = conversationId;
      message.content = content;
      message.role = role as 'user' | 'assistant';
      
      // 如果有blocks，直接赋值
      if (blocks) {
        message.blocks = blocks as ContentBlock[];
      }
      
      // 如果有functionCalls，直接赋值
      if (functionCalls) {
        message.functionCalls = functionCalls as FunctionCall[];
      }

      const savedMessage = await this.messageRepository.create(message);
      
      // 更新会话的更新时间
      await this.conversationRepository.update(conversationId, {
        updatedAt: new Date()
      });

      res.status(201).json(savedMessage);
    } catch (error) {
      console.error('添加消息失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 获取会话中的所有消息
  getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { conversationId } = req.params;
      const conversation = await this.conversationRepository.findById(conversationId);

      if (!conversation) {
        res.status(404).json({ message: '会话不存在' });
        return;
      }

      // 验证该会话是否属于当前用户
      if (conversation.userId !== req.user.id) {
        res.status(403).json({ message: '无权查看该会话消息' });
        return;
      }

      const messages = await this.messageRepository.findByConversationId(conversationId);
      res.json(messages);
    } catch (error) {
      console.error('获取消息失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };
} 