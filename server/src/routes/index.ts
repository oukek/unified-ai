import { Express, Request, Response } from 'express';
import apiRoutes from './api';

/**
 * 设置应用路由
 */
export function setupRoutes(app: Express): void {
  // API 路由
  app.use('/api', apiRoutes);
} 