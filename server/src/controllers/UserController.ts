import { Request, Response } from 'express';
import { UserRepository } from '../repositories/UserRepository';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

export class UserController {
  private userRepository: UserRepository;
  private JWT_SECRET = process.env.JWT_SECRET || 'unifiedai_secret_key';

  constructor() {
    this.userRepository = new UserRepository();
  }

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        res.status(400).json({ message: '用户名和密码不能为空' });
        return;
      }
      
      // 检查用户名是否已存在
      const existingUser = await this.userRepository.findByUsername(username);
      if (existingUser) {
        res.status(409).json({ message: '用户名已存在' });
        return;
      }
      
      // 加密密码
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // 创建用户
      const user = await this.userRepository.create({
        username,
        password: hashedPassword
      });
      
      // 移除密码字段
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json({
        message: '注册成功',
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('注册失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        res.status(400).json({ message: '用户名和密码不能为空' });
        return;
      }
      
      // 查找用户
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        res.status(401).json({ message: '用户名或密码错误' });
        return;
      }
      
      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({ message: '用户名或密码错误' });
        return;
      }
      
      // 生成JWT令牌
      const token = jwt.sign(
        { id: user.id, username: user.username },
        this.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      // 移除密码字段
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({
        message: '登录成功',
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      console.error('登录失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: '未授权' });
        return;
      }
      
      const user = await this.userRepository.findById(req.user.id);
      if (!user) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }
      
      // 移除密码字段
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error('获取当前用户信息失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.userRepository.findAll();
      res.json(users);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const user = await this.userRepository.findById(id);
      
      if (!user) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }
      
      res.json(user);
    } catch (error) {
      console.error('获取用户详情失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.userRepository.create(req.body);
      res.status(201).json(user);
    } catch (error) {
      console.error('创建用户失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const updatedUser = await this.userRepository.update(id, req.body);
      
      if (!updatedUser) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error('更新用户失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const result = await this.userRepository.delete(id);
      
      if (!result) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('删除用户失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  };
} 