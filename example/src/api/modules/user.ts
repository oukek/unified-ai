import api from '../instance';
import type { User, ApiResponse } from '../types';

/**
 * 用户相关API
 */
export const userApi = {
  /**
   * 获取所有用户
   */
  getAll: (): ApiResponse<User[]> => {
    return api.get('/users');
  },

  /**
   * 获取指定用户
   * @param id 用户ID
   */
  getById: (id: string): ApiResponse<User> => {
    return api.get(`/users/${id}`);
  },

  /**
   * 创建用户
   * @param user 用户信息
   */
  create: (user: Partial<User>): ApiResponse<User> => {
    return api.post('/users', user);
  },

  /**
   * 更新用户
   * @param id 用户ID
   * @param user 更新的用户信息
   */
  update: (id: string, user: Partial<User>): ApiResponse<User> => {
    return api.put(`/users/${id}`, user);
  },

  /**
   * 删除用户
   * @param id 用户ID
   */
  delete: (id: string): ApiResponse<void> => {
    return api.delete(`/users/${id}`);
  },
};

export default userApi; 