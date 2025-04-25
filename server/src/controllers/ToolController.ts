import { Request, Response } from 'express';
import { UserToolsRepository } from '../repositories/UserToolsRepository';
import { availableTools, Tool } from '../utils/tools';

export class ToolController {
  private userToolsRepository: UserToolsRepository;

  constructor() {
    this.userToolsRepository = new UserToolsRepository();
  }

  // 获取系统支持的所有工具
  getAllTools = async (req: Request, res: Response): Promise<void> => {
    try {
      // 简化工具信息，移除executor函数，只返回必要信息
      const tools = availableTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        configRequired: tool.configRequired || []
      }));
      
      res.json(tools);
    } catch (error) {
      console.error('获取工具列表失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 获取用户已启用的工具
  getUserTools = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const userTools = await this.userToolsRepository.findByUserId(req.user.id);
      
      if (!userTools) {
        // 如果用户还没有工具配置，返回空数组
        res.json({ enabledTools: [], toolConfigs: {} });
        return;
      }
      
      res.json({
        enabledTools: userTools.enabledTools || [],
        toolConfigs: userTools.toolConfigs || {}
      });
    } catch (error) {
      console.error('获取用户工具配置失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 更新用户已启用的工具
  updateUserTools = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { enabledTools, toolConfigs } = req.body;
      
      // 验证enabledTools是否为数组
      if (enabledTools && !Array.isArray(enabledTools)) {
        res.status(400).json({ message: 'enabledTools应为字符串数组' });
        return;
      }
      
      // 验证toolConfigs是否为对象
      if (toolConfigs && (typeof toolConfigs !== 'object' || Array.isArray(toolConfigs))) {
        res.status(400).json({ message: 'toolConfigs应为对象' });
        return;
      }
      
      // 验证enabledTools中的工具名称是否有效
      if (enabledTools) {
        const validToolNames = availableTools.map(tool => tool.name);
        const invalidTools = enabledTools.filter((name: string) => !validToolNames.includes(name));
        
        if (invalidTools.length > 0) {
          res.status(400).json({ 
            message: '包含无效的工具名称', 
            invalidTools 
          });
          return;
        }
      }

      // 保存用户工具配置
      const updatedUserTools = await this.userToolsRepository.updateByUserId(req.user.id, {
        enabledTools: enabledTools !== undefined ? enabledTools : undefined,
        toolConfigs: toolConfigs !== undefined ? toolConfigs : undefined
      });
      
      res.json({
        message: '工具配置更新成功',
        enabledTools: updatedUserTools?.enabledTools || [],
        toolConfigs: updatedUserTools?.toolConfigs || {}
      });
    } catch (error) {
      console.error('更新用户工具配置失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };
} 