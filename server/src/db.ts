import { DataSource } from 'typeorm';
import { dbConfig } from './config';

// 创建 TypeORM 数据源
export const AppDataSource = new DataSource(dbConfig);

// 初始化数据库连接
export const initializeDb = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('数据库连接已建立');
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}; 