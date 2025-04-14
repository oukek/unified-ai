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
    return `${prompt}\n\nYou can call the following functions:\n${JSON.stringify(functionDefinitions, null, 2)}\n\n
To call a function, please use only the following standardized JSON format:

For a single function call:
{
  "function_call": {
    "name": "function_name",
    "arguments": {
      "parameter_name": "parameter_value"
    }
  }
}

If you need to make multiple function calls at once, use this format:
{
  "function_calls": [
    {
      "name": "first_function_name",
      "arguments": {
        "parameter_name": "parameter_value"
      }
    },
    {
      "name": "second_function_name",
      "arguments": {
        "parameter_name": "parameter_value"
      }
    }
  ]
}

If you need to include function calls within your response, use this format:
{
  "response": "Your text response here",
  "function_call": {
    "name": "function_name",
    "arguments": {
      "parameter_name": "parameter_value"
    }
  }
}

If you need to suggest a follow-up function call after seeing the result of the first one:
{
  "response": "Your analysis of the first function call result",
  "next_function_call": {
    "name": "next_function_name",
    "arguments": {
      "parameter_name": "parameter_value"
    }
  }
}

Please use ONLY these exact formats for function calls. Do not invent other formats or property names.`
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
My previous question was: ${originalPrompt}

Your response was:
${previousResponse}

Here are the results of the function calls:
${functionResultsSummary}

Please generate a final response that incorporates all this information. If you need to call additional functions, please clearly indicate this.
${responseFormat === ResponseFormat.JSON ? '\nReturn your response in valid JSON format.' : ''}
`
  }
}
