import api from '../instance';
import type { User, ApiResponse } from '../types';

/**
 * 认证相关API
 */
export const authApi = {
  /**
   * 用户注册
   * @param username 用户名
   * @param password 密码
   */
  register: (username: string, password: string): ApiResponse<{ message: string; user: User }> => {
    return api.post('/auth/register', { username, password });
  },

  /**
   * 用户登录
   * @param username 用户名
   * @param password 密码
   */
  login: (username: string, password: string): ApiResponse<{ message: string; user: User; token: string }> => {
    return api.post('/auth/login', { username, password });
  },

  /**
   * 获取当前用户信息
   */
  getCurrentUser: (): ApiResponse<{ user: User }> => {
    return api.get('/auth/me');
  },
};

export default authApi; 