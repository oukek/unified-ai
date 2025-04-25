// 配置文件
import * as dotenv from 'dotenv';
import { DataSourceOptions } from 'typeorm';
import * as path from 'path';

// 加载环境变量
dotenv.config();

// 数据库配置
export const dbConfig: DataSourceOptions = {
  type: 'sqlite',
  database: process.env.DB_PATH || path.join(__dirname, '../database.sqlite'),
  entities: [path.join(__dirname, 'entities/**/*.{js,ts}')],
};

// 主配置对象
export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // 在这里添加其他配置项
}; 