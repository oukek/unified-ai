import api from '../instance';
import type { Tool, UserTools, ApiResponse } from '../types';

/**
 * 工具相关API
 */
export const toolApi = {
  /**
   * 获取所有可用工具
   */
  getAllTools: (): ApiResponse<Tool[]> => {
    return api.get('/tools');
  },

  /**
   * 获取用户已启用的工具
   */
  getUserTools: (): ApiResponse<UserTools> => {
    return api.get('/user/tools');
  },

  /**
   * 更新用户已启用的工具
   * @param enabledTools 启用的工具名称列表（可选）
   * @param toolConfigs 工具配置（可选）
   */
  updateUserTools: (enabledTools?: string[], toolConfigs?: Record<string, any>): ApiResponse<{
    message: string;
    enabledTools: string[];
    toolConfigs: Record<string, any>;
  }> => {
    return api.put('/user/tools', { enabledTools, toolConfigs });
  },
};

export default toolApi; 