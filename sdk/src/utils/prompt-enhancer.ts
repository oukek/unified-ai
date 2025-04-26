import type { AgentFunction } from '../types'
import { ResponseFormat } from '../types'

/**
 * 提示增强器
 * 用于增强聊天提示，添加函数定义和调用格式说明
 */
export class PromptEnhancer {
  /**
   * 增强聊天提示，添加函数定义和调用格式
   * @param prompt 原始提示
   * @param functions 可用函数列表
   * @returns 增强后的提示
   */
  static enhancePrompt(prompt: string, functions: AgentFunction[]): string {
    if (functions.length === 0) {
      return prompt
    }

    // 构建函数定义的JSON格式
    const functionDefinitions = functions.map(f => ({
      name: f.name,
      description: f.description,
      parameters: f.parameters,
    }))

    // 添加函数说明和规范的调用格式
    return `${prompt}

    You are an intelligent assistant capable of invoking tools to complete tasks efficiently.
    You have access to the following tools.  
    **When you determine that a task requires a tool, invoke the tool directly without asking the user for permission.**
    
    Below is the full list of available tools.  
    **Only use the tool names and parameters exactly as defined below. Do not modify or create new tools.**
    
    ${JSON.stringify(functionDefinitions, null, 2)}
    
    ---
    
    ### 📌 Tool Invocation Format
    
    When invoking tools, strictly follow the format below.  
    **Do not include any additional text, markdown, or explanations. Output only the JSON inside the tags.**
    
    1. Use only the tool names provided above — they must match exactly.
    2. Provide arguments in JSON format, with correct field names and types.
    3. If you don't need to call any tool, proceed with a normal response — do not output any JSON block.
    
    ### ✅ Format:
    
    <==start_tool_calls==>
    {
      "function_calls": [
        {
          "name": "ToolName1",
          "arguments": {
            "param1": "value1",
            "param2": "value2"
          }
        },
        {
          "name": "ToolName2",
          "arguments": {
            "paramA": "valueA"
          }
        }
      ]
    }
    <==end_tool_calls==>
    
    **Strictly follow the format above. Do not add any extra characters, explanations, or formatting.**`
  }

  /**
   * 创建函数执行后的跟进提示
   * @param originalPrompt 原始用户提示
   * @param previousResponse 上一次模型的响应
   * @param functionResultsSummary 函数执行结果摘要
   * @param responseFormat 响应格式要求
   * @returns 跟进提示
   */
  static createFollowupPrompt(
    originalPrompt: string,
    previousResponse: string,
    functionResultsSummary: string,
    responseFormat?: ResponseFormat,
  ): string {
    return `
IMPORTANT - Remember that the user's original question was: "${originalPrompt}"

Your previous response was:
${previousResponse}

Here are the results of the function calls:
${functionResultsSummary}

Please generate a final response that directly answers the user's original question: "${originalPrompt}"
If you need to call additional functions, please clearly indicate this.
${responseFormat === ResponseFormat.JSON ? '\nReturn your response in valid JSON format.' : ''}
`
  }
}
