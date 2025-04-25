import { Router, Request, Response } from 'express';
import { UserController } from '../controllers/UserController';
import { ConfigController } from '../controllers/ConfigController';
import { ConversationController } from '../controllers/ConversationController';
import { ToolController } from '../controllers/ToolController';
import { authenticateToken } from '../middlewares/auth';

const router: Router = Router();
const userController = new UserController();
const configController = new ConfigController();
const conversationController = new ConversationController();
const toolController = new ToolController();

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

// 工具路由
router.get('/tools', toolController.getAllTools); // 获取所有可用工具（无需登录）
router.get('/user/tools', authenticateToken, toolController.getUserTools); // 获取用户启用的工具
router.put('/user/tools', authenticateToken, toolController.updateUserTools); // 更新用户启用的工具

// 在这里添加更多路由

export default router; 