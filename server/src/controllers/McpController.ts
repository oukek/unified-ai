import { Request, Response } from 'express';
import { UserMcpRepository } from '../repositories/UserMcpRepository';
import { availableMcps, Mcp } from '../utils/mcps';

export class McpController {
  private userMcpRepository: UserMcpRepository;

  constructor() {
    this.userMcpRepository = new UserMcpRepository();
  }

  // 获取系统支持的所有MCP
  getAllMcps = async (req: Request, res: Response): Promise<void> => {
    try {
      // 简化MCP信息，返回必要信息
      const mcps = availableMcps.map(mcp => ({
        name: mcp.name,
        desc: mcp.desc,
        command: mcp.command,
        args: mcp.args,
        env: mcp.env || {}
      }));
      
      res.json(mcps);
    } catch (error) {
      console.error('获取MCP列表失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 获取用户已启用的MCP
  getUserMcps = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const userMcps = await this.userMcpRepository.findByUserId(req.user.id);
      
      if (!userMcps) {
        // 如果用户还没有MCP配置，返回空数组
        res.json({ enabledMcps: [], mcpConfigs: {} });
        return;
      }
      
      res.json({
        enabledMcps: userMcps.enabledMcps || [],
        mcpConfigs: userMcps.mcpConfigs || {}
      });
    } catch (error) {
      console.error('获取用户MCP配置失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 更新用户已启用的MCP
  updateUserMcps = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { enabledMcps, mcpConfigs } = req.body;
      
      // 验证enabledMcps是否为数组
      if (enabledMcps && !Array.isArray(enabledMcps)) {
        res.status(400).json({ message: 'enabledMcps应为字符串数组' });
        return;
      }
      
      // 验证mcpConfigs是否为对象
      if (mcpConfigs && (typeof mcpConfigs !== 'object' || Array.isArray(mcpConfigs))) {
        res.status(400).json({ message: 'mcpConfigs应为对象' });
        return;
      }
      
      // 验证mcpConfigs中的配置是否有效
      if (mcpConfigs) {
        for (const [name, config] of Object.entries(mcpConfigs)) {
          // 检查config是否为对象且包含必要字段
          if (typeof config !== 'object' || Array.isArray(config)) {
            res.status(400).json({ 
              message: `MCP '${name}' 的配置格式无效`,
              invalidMcp: name
            });
            return;
          }
          
          // 检查必要字段
          const typedConfig = config as any;
          if (!typedConfig.command || typeof typedConfig.command !== 'string') {
            res.status(400).json({ 
              message: `MCP '${name}' 的command字段无效`,
              invalidMcp: name
            });
            return;
          }
          
          if (!typedConfig.args || !Array.isArray(typedConfig.args)) {
            res.status(400).json({ 
              message: `MCP '${name}' 的args字段无效`,
              invalidMcp: name
            });
            return;
          }
          
          // 检查可选字段
          if (typedConfig.env && (typeof typedConfig.env !== 'object' || Array.isArray(typedConfig.env))) {
            res.status(400).json({ 
              message: `MCP '${name}' 的env字段无效`,
              invalidMcp: name
            });
            return;
          }
        }
      }

      // 保存用户MCP配置
      const updatedUserMcps = await this.userMcpRepository.updateByUserId(req.user.id, {
        enabledMcps: enabledMcps !== undefined ? enabledMcps : undefined,
        mcpConfigs: mcpConfigs !== undefined ? mcpConfigs : undefined
      });
      
      res.json({
        message: 'MCP配置更新成功',
        enabledMcps: updatedUserMcps?.enabledMcps || [],
        mcpConfigs: updatedUserMcps?.mcpConfigs || {}
      });
    } catch (error) {
      console.error('更新用户MCP配置失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };
} 