import fs from 'node:fs'
import path from 'node:path'
import * as process from 'node:process'

interface Config {
  geminiApiKey?: string
}

/**
 * 配置服务类，用于管理API密钥和设置
 */
class ConfigService {
  private static CONFIG_FILE = path.join(process.cwd(), 'config.json')
  private config: Config = {}

  constructor() {
    this.loadConfig()
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(ConfigService.CONFIG_FILE)) {
        const configData = fs.readFileSync(ConfigService.CONFIG_FILE, 'utf8')
        this.config = JSON.parse(configData)
        console.log('已加载配置文件')
      }
      else {
        console.log('配置文件不存在，将使用默认配置')
        this.saveConfig() // 创建默认配置文件
      }
    }
    catch (error) {
      console.error('加载配置文件时出错:', error)
      this.config = {}
    }
  }

  /**
   * 保存配置到文件
   */
  private saveConfig(): void {
    try {
      fs.writeFileSync(
        ConfigService.CONFIG_FILE,
        JSON.stringify(this.config, null, 2),
        'utf8',
      )
      console.log('配置已保存')
    }
    catch (error) {
      console.error('保存配置文件时出错:', error)
    }
  }

  /**
   * 获取Gemini API密钥
   */
  getGeminiApiKey(): string | undefined {
    return this.config.geminiApiKey
  }

  /**
   * 设置Gemini API密钥
   */
  setGeminiApiKey(apiKey: string): void {
    this.config.geminiApiKey = apiKey
    this.saveConfig()
  }

  /**
   * 获取完整配置
   */
  getConfig(): Config {
    return { ...this.config }
  }
}

// 导出单例
export const configService = new ConfigService()
