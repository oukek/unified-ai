import { Repository } from 'typeorm';
import { UserMcp } from '../entities/UserMcp';
import { AppDataSource } from '../db';

export class UserMcpRepository {
  private repository: Repository<UserMcp>;

  constructor() {
    this.repository = AppDataSource.getRepository(UserMcp);
  }

  async findByUserId(userId: string): Promise<UserMcp | null> {
    return this.repository.findOneBy({ userId });
  }

  async create(data: Partial<UserMcp>): Promise<UserMcp> {
    const userMcp = this.repository.create(data);
    return this.repository.save(userMcp);
  }

  async update(id: string, data: Partial<UserMcp>): Promise<UserMcp | null> {
    await this.repository.update(id, data);
    return this.repository.findOneBy({ id });
  }

  async updateByUserId(userId: string, data: Partial<UserMcp>): Promise<UserMcp | null> {
    const userMcp = await this.findByUserId(userId);
    
    if (userMcp) {
      // 更新现有记录
      await this.repository.update(userMcp.id, data);
      return this.repository.findOneBy({ id: userMcp.id });
    } else {
      // 创建新记录
      const newUserMcp = this.repository.create({
        userId,
        ...data
      });
      return this.repository.save(newUserMcp);
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return !!result?.affected && result.affected > 0;
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await this.repository.delete({ userId });
    return !!result?.affected && result.affected > 0;
  }
} 