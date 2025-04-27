import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

// 扩展Express Request类型，添加用户信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
      };
    }
  }
}

// JWT密钥，应该从环境变量中获取
const JWT_SECRET = process.env.JWT_SECRET || 'unifiedai_secret_key';

/**
 * 验证JWT令牌的中间件
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  // 从请求头获取令牌
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN格式
  
  if (!token) {
    res.status(401).json({ message: '未提供访问令牌' });
    return;
  }
  
  try {
    // 验证令牌
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
    req.user = decoded;
    next();
  } catch (error) {
    console.error('验证令牌失败:', error);
    res.status(403).json({ message: '无效或过期的令牌' });
  }
};

/**
 * 可选的验证令牌中间件，如果有令牌则验证，没有则跳过
 */
export const optionalAuthenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    next();
    return;
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
    req.user = decoded;
    next();
  } catch (error) {
    // 令牌无效，但不阻止请求继续
    next();
  }
}; 