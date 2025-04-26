import { getSocket, onEvent, offEvent, emitEvent } from './socket';
import type { ContentBlock, FunctionCall } from '../api/types';

/**
 * AI流式响应回调类型
 */
export interface AIStreamCallbacks {
  onStart?: () => void;
  onContent?: (content: string) => void;
  onFunctionCallStart?: (call: FunctionCall) => void;
  onFunctionCallEnd?: (call: FunctionCall) => void;
  onComplete?: (result: {
    userMessage: any,
    assistantMessage: any
  }) => void;
  onError?: (error: string) => void;
}

/**
 * 开始AI流式聊天
 * @param conversationId 会话ID
 * @param content 用户消息内容
 * @param callbacks 回调函数集合
 */
export function startAIStreamChat(
  conversationId: string, 
  content: string,
  callbacks: AIStreamCallbacks
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // 获取socket实例
    const socket = getSocket();
    if (!socket) {
      const error = '未连接到WebSocket服务器';
      if (callbacks.onError) callbacks.onError(error);
      reject(new Error(error));
      return;
    }

    // 响应的内容和块
    let fullContent = '';
    const contentBlocks: ContentBlock[] = [];
    
    // 立即通知开始，确保UI可以立即显示加载状态
    if (callbacks.onStart) {
      callbacks.onStart();
    }
    
    // 创建一个文本块的工具函数
    const addTextBlock = (text: string) => {
      if (!text) return;
      
      // 如果最后一个块是文本块，则追加内容
      const lastBlock = contentBlocks[contentBlocks.length - 1];
      if (lastBlock && lastBlock.type === 'text') {
        lastBlock.content += text;
      } else {
        // 否则创建新的文本块
        contentBlocks.push({
          type: 'text',
          content: text
        });
      }
    };
    
    // 设置更新事件的监听器
    const handleUpdate = (data: any) => {
      // 只处理当前会话的更新
      if (data.conversationId !== conversationId) return;
      
      const { type, data: eventData } = data;
      
      if (type === 'responseChunk' && eventData.chunk && eventData.chunk.content) {
        const newContent = eventData.chunk.content;
        fullContent += newContent;
        addTextBlock(newContent);
        
        // 确保内容回调函数总是被调用，即使内容为空也触发UI更新
        if (callbacks.onContent) {
          try {
            callbacks.onContent(newContent);
          } catch (err) {
            console.error('回调函数执行错误:', err);
          }
        }
      } else if (type === 'functionCallStart' && eventData.functionCalls && eventData.functionCalls.length > 0) {
        for (const call of eventData.functionCalls) {
          contentBlocks.push({
            type: 'tool',
            data: call
          });
          
          if (callbacks.onFunctionCallStart) {
            try {
              callbacks.onFunctionCallStart(call);
            } catch (err) {
              console.error('函数调用开始回调错误:', err);
            }
          }
        }
      } else if (type === 'functionCallEnd' && eventData.functionCalls && eventData.functionCalls.length > 0) {
        for (const call of eventData.functionCalls) {
          const blockIndex = contentBlocks.findIndex(
            block => block.type === 'tool' && block.data?.id === call.id
          );
          if (blockIndex !== -1) {
            contentBlocks[blockIndex].data = call;
          }
          
          if (callbacks.onFunctionCallEnd) {
            try {
              callbacks.onFunctionCallEnd(call);
            } catch (err) {
              console.error('函数调用结束回调错误:', err);
            }
          }
        }
      }
    };
    
    // 设置完成事件的监听器
    const handleComplete = (data: any) => {
      // 只处理当前会话的完成事件
      if (data.conversationId !== conversationId) return;
      
      if (callbacks.onComplete) callbacks.onComplete(data.result);
      
      // 移除所有监听器
      cleanup();
      resolve(true);
    };
    
    // 设置错误事件的监听器
    const handleError = (data: any) => {
      // 只处理当前会话的错误
      if (data.conversationId !== conversationId) return;
      
      if (callbacks.onError) callbacks.onError(data.error);
      
      // 移除所有监听器
      cleanup();
      reject(new Error(data.error));
    };
    
    // 注册所有事件监听器
    onEvent('ai:chatUpdate', handleUpdate);
    onEvent('ai:chatComplete', handleComplete);
    onEvent('ai:chatError', handleError);
    
    // 清理函数，用于移除所有监听器
    const cleanup = () => {
      offEvent('ai:chatUpdate', handleUpdate);
      offEvent('ai:chatComplete', handleComplete);
      offEvent('ai:chatError', handleError);
    };
    
    // 发送流式聊天请求
    emitEvent('ai:chatStream', { conversationId, content }, (response: any) => {
      if (!response.success) {
        const errorMsg = response.error || '发送消息失败';
        if (callbacks.onError) callbacks.onError(errorMsg);
        cleanup();
        reject(new Error(errorMsg));
      }
    });
  });
}

export default {
  startAIStreamChat
}; 