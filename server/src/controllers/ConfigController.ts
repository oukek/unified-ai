import { Request, Response } from 'express';
import { ConfigRepository } from '../repositories/ConfigRepository';

export class ConfigController {
  private configRepository: ConfigRepository;

  constructor() {
    this.configRepository = new ConfigRepository();
  }

  // 获取用户的所有配置
  getUserConfigs = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const configs = await this.configRepository.findByUserId(req.user.id);
      
      // 转换value字段为JSON对象
      const configsWithParsedValue = configs.map(config => ({
        ...config,
        value: JSON.parse(config.value)
      }));
      
      res.json(configsWithParsedValue);
    } catch (error) {
      console.error('获取用户配置失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 获取用户特定类型的配置
  getUserConfigByType = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { type } = req.params;
      if (!type) {
        res.status(400).json({ message: '配置类型不能为空' });
        return;
      }

      const config = await this.configRepository.findByUserIdAndType(req.user.id, type);
      
      if (!config) {
        res.status(404).json({ message: '配置不存在' });
        return;
      }
      
      // 将value字段从字符串转换为JSON对象
      const configWithParsedValue = {
        ...config,
        value: JSON.parse(config.value)
      };
      
      res.json(configWithParsedValue);
    } catch (error) {
      console.error('获取用户配置详情失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 创建或更新用户配置
  upsertUserConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { type } = req.params;
      const { value, description } = req.body;

      if (!type) {
        res.status(400).json({ message: '配置类型不能为空' });
        return;
      }

      if (value === undefined) {
        res.status(400).json({ message: '配置值不能为空' });
        return;
      }

      // 将value对象转换为JSON字符串存储
      const valueString = typeof value === 'string' ? value : JSON.stringify(value);
      
      const config = await this.configRepository.upsertByUserIdAndType(
        req.user.id,
        type,
        valueString,
        description
      );
      
      // 将value字段从字符串转换为JSON对象
      const configWithParsedValue = {
        ...config,
        value: JSON.parse(config.value)
      };
      
      res.json({
        message: '配置保存成功',
        config: configWithParsedValue
      });
    } catch (error) {
      console.error('保存用户配置失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  // 删除用户配置
  deleteUserConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }

      const { type } = req.params;
      if (!type) {
        res.status(400).json({ message: '配置类型不能为空' });
        return;
      }

      const result = await this.configRepository.deleteByUserIdAndType(req.user.id, type);
      
      if (!result) {
        res.status(404).json({ message: '配置不存在' });
        return;
      }
      
      res.json({ message: '配置删除成功' });
    } catch (error) {
      console.error('删除用户配置失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };
} 