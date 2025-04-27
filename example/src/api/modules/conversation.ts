import api from '../instance';
import type { Conversation, ChatMessage, ApiResponse } from '../types';

/**
 * 会话相关API
 */
export const conversationApi = {
  /**
   * 获取用户所有会话
   */
  getUserConversations: (): ApiResponse<Conversation[]> => {
    return api.get('/conversations');
  },

  /**
   * 获取会话详情，包括消息
   * @param id 会话ID
   */
  getConversationDetail: (id: string): ApiResponse<Conversation & { messages: ChatMessage[] }> => {
    return api.get(`/conversations/${id}`);
  },

  /**
   * 创建会话
   * @param title 会话标题
   * @param systemMessage 系统消息（可选）
   */
  createConversation: (title: string, systemMessage?: string): ApiResponse<Conversation> => {
    return api.post('/conversations', { title, systemMessage });
  },

  /**
   * 更新会话信息
   * @param id 会话ID
   * @param data 更新的会话信息
   */
  updateConversation: (id: string, data: Partial<Conversation>): ApiResponse<Conversation> => {
    return api.put(`/conversations/${id}`, data);
  },

  /**
   * 删除会话
   * @param id 会话ID
   */
  deleteConversation: (id: string): ApiResponse<{ message: string }> => {
    return api.delete(`/conversations/${id}`);
  },

  /**
   * 获取会话中的所有消息
   * @param conversationId 会话ID
   */
  getMessages: (conversationId: string): ApiResponse<ChatMessage[]> => {
    return api.get(`/conversations/${conversationId}/messages`);
  }
};

export default conversationApi; 