import api from '../instance';
import type { Mcp, UserMcps, ApiResponse } from '../types';

/**
 * MCP相关API
 */
export const mcpApi = {
  /**
   * 获取所有可用MCP
   */
  getAllMcps: (): ApiResponse<Mcp[]> => {
    return api.get('/mcps');
  },

  /**
   * 获取用户已启用的MCP
   */
  getUserMcps: (): ApiResponse<UserMcps> => {
    return api.get('/user/mcps');
  },

  /**
   * 更新用户已启用的MCP
   * @param enabledMcps 启用的MCP名称列表（可选）
   * @param mcpConfigs MCP配置（可选）
   */
  updateUserMcps: (enabledMcps?: string[], mcpConfigs?: Record<string, any>): ApiResponse<{
    message: string;
    enabledMcps: string[];
    mcpConfigs: Record<string, any>;
  }> => {
    return api.put('/user/mcps', { enabledMcps, mcpConfigs });
  },
}; 