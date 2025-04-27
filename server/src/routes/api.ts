import { Router, Request, Response } from 'express';
import { UserController } from '../controllers/UserController';
import { ConfigController } from '../controllers/ConfigController';
import { ConversationController } from '../controllers/ConversationController';
import { ToolController } from '../controllers/ToolController';
import { McpController } from '../controllers/McpController';
import { AIController } from '../controllers/AIController';
import { authenticateToken } from '../middlewares/auth';

const router: Router = Router();
const userController = new UserController();
const configController = new ConfigController();
const conversationController = new ConversationController();
const toolController = new ToolController();
const mcpController = new McpController();
const aiController = new AIController();

// 认证路由
router.post('/auth/register', userController.register);
router.post('/auth/login', userController.login);
router.get('/auth/me', authenticateToken, userController.getCurrentUser);

// 用户路由
router.get('/users', userController.getAll);
router.get('/users/:id', userController.getById);
router.post('/users', userController.create);
router.put('/users/:id', userController.update);
router.delete('/users/:id', userController.delete);

// 配置路由
router.get('/configs', authenticateToken, configController.getUserConfigs);
router.get('/configs/:type', authenticateToken, configController.getUserConfigByType);
router.put('/configs/:type', authenticateToken, configController.upsertUserConfig);
router.delete('/configs/:type', authenticateToken, configController.deleteUserConfig);

// 会话路由
router.get('/conversations', authenticateToken, conversationController.getUserConversations);
router.get('/conversations/:id', authenticateToken, conversationController.getConversationDetail);
router.post('/conversations', authenticateToken, conversationController.createConversation);
router.put('/conversations/:id', authenticateToken, conversationController.updateConversation);
router.delete('/conversations/:id', authenticateToken, conversationController.deleteConversation);

// 消息路由
router.get('/conversations/:conversationId/messages', authenticateToken, conversationController.getMessages);
router.post('/conversations/:conversationId/messages', authenticateToken, conversationController.addMessage);


// SSE 流式消息路由（POST方式，适用于长消息）
router.post('/conversations/:conversationId/messages/stream', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: '消息内容不能为空' });
      return;
    }
    
    // 设置SSE所需的头部
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    await aiController.handleStreamMessageSSE(userId, conversationId, content, res);
  } catch (error: any) {
    // 如果还没发送响应头，则发送错误JSON
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || '处理消息失败' });
    } else {
      // 如果已经开始SSE流，则发送错误事件
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: error.message || '处理消息失败' })}\n\n`);
      res.end();
    }
  }
});

// 工具路由
router.get('/tools', toolController.getAllTools); // 获取所有可用工具（无需登录）
router.get('/user/tools', authenticateToken, toolController.getUserTools); // 获取用户启用的工具
router.put('/user/tools', authenticateToken, toolController.updateUserTools); // 更新用户启用的工具

// MCP路由
router.get('/mcps', mcpController.getAllMcps); // 获取所有可用MCP（无需登录）
router.get('/user/mcps', authenticateToken, mcpController.getUserMcps); // 获取用户启用的MCP
router.put('/user/mcps', authenticateToken, mcpController.updateUserMcps); // 更新用户启用的MCP

// 在这里添加更多路由

export default router; 