import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config as dotenvConfig } from 'dotenv';
import { initializeDb } from './db';
import { config } from './config';
import { setupRoutes } from './routes';
import { setupSocketHandlers } from './socket';

// 加载环境变量
dotenvConfig();

// 创建Express应用
const app = express();
const PORT = config.port;

// 中间件
app.use(cors());
app.use(express.json());

// HTTP服务器
const httpServer = createServer(app);

// Socket.io服务器
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});
console.log('Socket.io 服务器已初始化');

// 设置路由
setupRoutes(app);

// 设置 Socket 处理器
setupSocketHandlers(io);
console.log('Socket 处理器已设置完成');

// 数据库连接
initializeDb()
  .then(() => {
    // 启动服务器
    httpServer.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('数据库连接失败:', error);
  }); 
