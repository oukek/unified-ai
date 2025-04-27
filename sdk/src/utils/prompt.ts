import type { AgentFunctionSchema, ChatOptions } from '../types'
/**
 * prompt.ts
 *
 * 集中管理 SDK 中使用的所有提示模板
 */
import { ResponseFormat } from '../types'

/**
 * 通用系统提示
 * 用于增强AI助手的能力描述和行为指导
 */
export const ASSISTANT_SYSTEM_PROMPT = `你是一个强大的智能助手，运行在面向普通用户的应用程序中，目标是帮助用户高效、准确、自然地完成各种任务。你的回应应基于实际需求，如直接回答问题、提供解释、生成内容或调用工具。
除非用户指定使用其他语言，否则请使用用户提问时使用的语言回复：`

/**
 * 工具使用指南提示
 * 用于指导AI如何使用工具
 */
export const TOOLS_GUIDANCE_PROMPT = `你可以使用工具来解决问题。关于工具调用，请遵循以下规则：
1. 始终严格按照指定的工具调用模式进行操作，确保提供所有必要的参数。
2. 对话可能会引用不再可用的工具。切勿调用未明确提供的工具。
3. **与用户交流时，切勿提及工具名称。**例如，不要说"我需要使用edit_file工具来编辑你的文件"，而应该说"我将编辑你的文件"。
4. 只有在必要时才调用工具。如果用户任务较为一般性或你已知道答案，无需调用工具直接回应即可。
5. 在调用每个工具之前，先向用户解释为什么要调用它。`

/**
 * 用户系统消息模板
 * 用于添加用户提供的系统消息
 */
export const USER_SYSTEM_MESSAGE_TEMPLATE = `这是用户的系统消息，在回应用户时你应当遵循它：
<system_message>
%s
</system_message>`

/**
 * 问题思考分析提示
 * 用于深度分析和梳理用户问题
 */
export const THINKING_SYSTEM_PROMPT = `作为AI助手，我需要分析并重构用户的问题，使其更加清晰和高效。
我的任务是：
1. 分析用户问题的本质："用户想要了解/获取/解决..."
2. 识别问题中的关键信息点和隐含需求
3. 重新表述问题，使其更加明确、结构化和易于理解
4. 提炼出问题的核心，消除歧义和冗余表达

这个分析过程应该使用自我思考的口吻，如"用户想要..."、"这个问题的核心是..."。
不要在分析中向用户提问，如"请问您是否需要..."。
目的是将用户可能不够高效的提问转化为更适合AI处理的形式。

请用与用户相同的语言分析，除非用户明确要求使用其他语言。
输出应该是纯文本格式，不包含其他额外信息。`

/**
 * 问题思考输入模板
 * 用于构建思考提示完整内容
 */
export const THINKING_INPUT_TEMPLATE = `%s

用户问题：
%s

请深度思考并梳理这个问题：`

/**
 * 工具调用说明提示
 * 用于向模型解释如何使用工具
 */
export const TOOL_INVOCATION_PROMPT = `
    你是一个能够调用工具高效完成任务的智能助手。
    你可以使用以下工具。
    **当你确定任务需要使用工具时，直接调用工具，无需征求用户许可。**
    
    以下是所有可用工具的完整列表。
    **只使用下面定义的工具名称和参数，不要修改或创建新工具。**
    
    %s
    
    ---
    
    ### 📌 工具调用格式
    
    调用工具时，严格遵循以下格式。
    **不要包含任何额外的文本、标记或解释。仅输出标签内的JSON。**
    
    1. 只使用上面提供的工具名称 — 必须完全匹配。
    2. 以JSON格式提供参数，字段名称和类型必须正确。
    3. 如果不需要调用任何工具，正常回应即可 — 不要输出任何JSON块。
    
    ### ✅ 格式：
    
    <==start_tool_calls==>
    {
      "function_calls": [
        {
          "name": "工具名称1",
          "arguments": {
            "参数1": "值1",
            "参数2": "值2"
          }
        },
        {
          "name": "工具名称2",
          "arguments": {
            "参数A": "值A"
          }
        }
      ]
    }
    <==end_tool_calls==>
    
    **严格遵循上述格式。不要添加任何额外的字符、解释或格式。**`

/**
 * 函数调用结果跟进提示
 * 用于在函数调用后请求最终回答
 */
export const FUNCTION_FOLLOWUP_PROMPT = `
重要提示 - 请记住，用户的原始问题是："%s"

你之前的回答是：
%s

以下是函数调用的结果：
%s

请生成一个直接回答用户原始问题的最终回应："%s"
如果你需要调用额外的函数，请明确说明。
%s
`

/**
 * 最大递归深度警告模板
 * 用于警告已达到最大递归深度
 */
export const MAX_RECURSION_DEPTH_WARNING = `已达到最大递归深度(%d)。最终结果可能不完整。\n\n%s`

/**
 * 问题思考工具分析提示
 * 用于在分析问题时考虑可能适用的工具，但不直接调用
 */
export const THINKING_TOOLS_PROMPT = `注意：在分析问题时，你可以考虑哪些工具可能对解决问题有帮助，但请不要直接调用任何工具。
这只是一个分析过程，目的是更好地理解用户的问题和可能的解决方案。
请记住，你的回答应该是一份分析，而不是执行操作。`

/**
 * 问题思考历史记录提示
 * 用于在分析问题时参考历史对话
 */
export const THINKING_HISTORY_PROMPT = `以下是用户的历史对话记录，可以帮助你更好地理解当前问题的上下文。
分析时请考虑这些历史信息，但最终返回的思考分析不要重复这些历史信息：

%s`

/**
 * 获取增强的系统消息
 *
 * @param options 聊天选项
 * @param tools 工具列表
 * @returns 增强后的系统消息
 */
export function getEnhancedSystemMessage<T extends ChatOptions | undefined = undefined>(
  options: T,
  tools: AgentFunctionSchema[],
): string {
  let systemMessage = ASSISTANT_SYSTEM_PROMPT

  if (tools.length > 0) {
    systemMessage = `${systemMessage}\n${TOOLS_GUIDANCE_PROMPT}`
  }

  if (options?.systemMessage) {
    systemMessage = `${systemMessage}\n${USER_SYSTEM_MESSAGE_TEMPLATE.replace('%s', options.systemMessage)}`
  }

  return systemMessage
}

/**
 * 获取问题思考提示
 *
 * @param prompt 用户原始提示
 * @returns 完整的思考分析提示
 */
export function getThinkingPrompt(prompt: string): string {
  return THINKING_INPUT_TEMPLATE.replace('%s', THINKING_SYSTEM_PROMPT).replace('%s', prompt)
}

/**
 * 获取带工具信息的问题思考提示
 *
 * @param prompt 用户原始提示
 * @param toolsDescription 工具描述信息
 * @param history 历史消息记录
 * @param systemMessage 系统消息
 * @returns 完整的思考分析提示，包含工具信息和历史
 */
export function getThinkingWithToolsPrompt(
  prompt: string,
  toolsDescription: string,
  history?: { role: string, content: string }[],
  systemMessage?: string,
): string {
  const baseThinkingPrompt = getThinkingPrompt(prompt)

  // 构建历史消息部分
  let historyPart = ''
  if (history && history.length > 0) {
    const historyText = history.map(msg =>
      `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`,
    ).join('\n\n')

    historyPart = `\n\n${THINKING_HISTORY_PROMPT.replace('%s', historyText)}`
  }

  // 添加系统消息部分
  const systemPart = systemMessage
    ? `\n\n系统指令（仅作参考，不要在思考结果中重复）：\n${systemMessage}`
    : ''

  return `${baseThinkingPrompt}${historyPart}${systemPart}
  
${toolsDescription}

${THINKING_TOOLS_PROMPT}

记住：你返回的思考分析应该仅关注于用户当前的问题，不要在结果中重复历史对话或系统指令的内容。思考分析应该帮助用户更好地理解问题本质和可能的解决方案。`
}

/**
 * 获取工具增强提示
 *
 * @param content 原始内容
 * @param tools 工具列表
 * @returns 增强后的提示
 */
export function getToolEnhancedPrompt(content: string, tools: AgentFunctionSchema[]): string {
  if (!tools || tools.length === 0) {
    return content
  }

  // 构建函数定义的JSON格式
  const functionDefinitions = tools.map(f => ({
    name: f.name,
    description: f.description,
    parameters: f.parameters,
  }))

  // 添加函数说明和规范的调用格式
  return `${content}${TOOL_INVOCATION_PROMPT.replace('%s', JSON.stringify(functionDefinitions, null, 2))}`
}

/**
 * 获取函数调用后的跟进提示
 *
 * @param originalPrompt 原始用户提示
 * @param previousResponse 上一次模型的响应
 * @param functionResultsSummary 函数执行结果摘要
 * @param responseFormat 响应格式要求
 * @returns 跟进提示
 */
export function getFunctionFollowupPrompt(
  originalPrompt: string,
  previousResponse: string,
  functionResultsSummary: string,
  responseFormat?: ResponseFormat,
): string {
  const jsonFormatInstruction = responseFormat === ResponseFormat.JSON
    ? '\n请以有效的JSON格式返回你的回应。'
    : ''

  return FUNCTION_FOLLOWUP_PROMPT
    .replace('%s', originalPrompt)
    .replace('%s', previousResponse)
    .replace('%s', functionResultsSummary)
    .replace('%s', originalPrompt)
    .replace('%s', jsonFormatInstruction)
}

/**
 * 获取最大递归深度警告
 *
 * @param depth 当前深度
 * @param cleanContent 清理后的内容
 * @returns 警告消息
 */
export function getMaxRecursionDepthWarning(depth: number, cleanContent: string): string {
  return MAX_RECURSION_DEPTH_WARNING.replace('%d', (depth + 1).toString()).replace('%s', cleanContent)
}
