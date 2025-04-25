import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config as dotenvConfig } from 'dotenv';
import { initializeDb } from './db';
import { config } from './config';
import { setupRoutes } from './routes';

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
    methods: ['GET', 'POST']
  }
});

setupRoutes(app);

// 数据库连接
initializeDb()
  .then(() => {
    // 启动服务器
    httpServer.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
    });
    
    // Socket.io 连接处理
    io.on('connection', (socket) => {
      console.log('客户端已连接:', socket.id);
      
      socket.on('disconnect', () => {
        console.log('客户端已断开连接:', socket.id);
      });
    });
  })
  .catch((error) => {
    console.error('数据库连接失败:', error);
  }); 