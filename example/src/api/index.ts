import authApi from './modules/auth';
import userApi from './modules/user';
import configApi from './modules/config';
import conversationApi from './modules/conversation';
import toolApi from './modules/tool';

// 导出所有类型
export * from './types';

// 导出API实例
export { default as apiInstance } from './instance';

// 导出各模块API
export {
  authApi,
  userApi,
  configApi,
  conversationApi,
  toolApi
};

// 默认导出合并的API对象
export default {
  auth: authApi,
  user: userApi,
  config: configApi,
  conversation: conversationApi,
  tool: toolApi,
}; 