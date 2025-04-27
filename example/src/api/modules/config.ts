import api from '../instance';
import type { Config, ApiResponse } from '../types';

/**
 * 配置相关API
 */
export const configApi = {
  /**
   * 获取用户所有配置
   */
  getUserConfigs: (): ApiResponse<Config[]> => {
    return api.get('/configs');
  },

  /**
   * 获取用户指定类型的配置
   * @param type 配置类型
   */
  getUserConfigByType: (type: string): ApiResponse<Config> => {
    return api.get(`/configs/${type}`);
  },

  /**
   * 创建或更新用户配置
   * @param type 配置类型
   * @param value 配置值
   * @param description 配置描述（可选）
   */
  upsertUserConfig: (type: string, value: any, description?: string): ApiResponse<{ message: string; config: Config }> => {
    return api.put(`/configs/${type}`, { value, description });
  },

  /**
   * 删除用户配置
   * @param type 配置类型
   */
  deleteUserConfig: (type: string): ApiResponse<{ message: string }> => {
    return api.delete(`/configs/${type}`);
  },
};

export default configApi; 