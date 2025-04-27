import type { ContentBlock, FunctionCall } from '../api/types';
import { fetchEventSource } from '@microsoft/fetch-event-source';

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
 * 开始AI流式聊天（使用SSE）
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
    // 立即通知开始，确保UI可以立即显示加载状态
    if (callbacks.onStart) {
      callbacks.onStart();
    }

    // 响应的内容和块
    let fullContent = '';
    const contentBlocks: ContentBlock[] = [];
    
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

    // 从localStorage获取认证token
    const token = localStorage.getItem('token');
    if (!token) {
      const errorMessage = '未找到认证令牌，请重新登录';
      if (callbacks.onError) {
        callbacks.onError(errorMessage);
      }
      reject(new Error(errorMessage));
      return;
    }

    // 准备URL和请求选项
    const baseURL = 'http://127.0.0.1:5656/api';
    const url = `${baseURL}/conversations/${encodeURIComponent(conversationId)}/messages/stream`;
    const controller = new AbortController();

    // 处理SSE事件
    function handleEvent(eventType: string, data: any) {
      switch (eventType) {
        case 'responseChunk':
          if (data.chunk && data.chunk.content) {
            const newContent = data.chunk.content;
            fullContent += newContent;
            addTextBlock(newContent);
            
            if (callbacks.onContent) {
              callbacks.onContent(newContent);
            }
          }
          break;
          
        case 'functionCallStart':
          if (data.functionCalls && data.functionCalls.length > 0) {
            for (const call of data.functionCalls) {
              contentBlocks.push({
                type: 'tool',
                data: call
              });
              
              if (callbacks.onFunctionCallStart) {
                callbacks.onFunctionCallStart(call);
              }
            }
          }
          break;
          
        case 'functionCallEnd':
          if (data.functionCalls && data.functionCalls.length > 0) {
            for (const call of data.functionCalls) {
              const blockIndex = contentBlocks.findIndex(
                block => block.type === 'tool' && block.data?.id === call.id
              );
              
              if (blockIndex !== -1) {
                contentBlocks[blockIndex].data = call;
              }
              
              if (callbacks.onFunctionCallEnd) {
                callbacks.onFunctionCallEnd(call);
              }
            }
          }
          break;
          
        case 'complete':
          if (callbacks.onComplete) {
            // 构造返回的消息结构以匹配WebSocket版本
            const result = {
              userMessage: {
                conversationId,
                content,
                role: 'user'
              },
              assistantMessage: {
                id: data.messageId,
                conversationId,
                content: data.content,
                blocks: data.blocks,
                functionCalls: data.functionCalls,
                role: 'assistant'
              }
            };
            
            callbacks.onComplete(result);
          }
          // 成功完成
          resolve(true);
          break;
          
        case 'error':
          const errorMessage = data.error || '未知错误';
          if (callbacks.onError) {
            callbacks.onError(errorMessage);
          }
          reject(new Error(errorMessage));
          break;
      }
    }

    fetchEventSource(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content }),
      signal: controller.signal,
      
      // 处理打开连接
      async onopen(response) {
        if (!response.ok) {
          // 请求失败
          let errorMessage = `请求失败: ${response.status} ${response.statusText}`;
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            errorMessage = '认证失败，请重新登录';
          }
          if (callbacks.onError) {
            callbacks.onError(errorMessage);
          }
          throw new Error(errorMessage);
        }
      },
      
      // 处理消息事件
      onmessage(event) {
        try {
          const eventData = JSON.parse(event.data);
          handleEvent(event.event, eventData);
        } catch (err) {
          console.error(`解析SSE事件数据失败: ${event.event}`, err);
        }
      },
      
      // 处理关闭连接
      onclose() {
        // 如果未完成则视为错误
        if (fullContent === '') {
          const errorMessage = '连接被意外关闭';
          if (callbacks.onError) {
            callbacks.onError(errorMessage);
          }
          reject(new Error(errorMessage));
        }
      },
      
      // 处理错误
      onerror(err) {
        const errorMessage = err instanceof Error ? err.message : '网络错误';
        if (callbacks.onError) {
          callbacks.onError(errorMessage);
        }
        throw err; // 让库重试或中止连接
      }
    }).catch(err => {
      // 最终错误处理
      if (err.name !== 'AbortError') {
        reject(err);
      }
    });

    // 返回一个取消函数
    return {
      cancel: () => {
        controller.abort();
      }
    };
  });
}

export default {
  startAIStreamChat
}; 