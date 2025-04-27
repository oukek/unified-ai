import { Repository } from 'typeorm';
import { UserTools } from '../entities/UserTools';
import { AppDataSource } from '../db';

export class UserToolsRepository {
  private repository: Repository<UserTools>;

  constructor() {
    this.repository = AppDataSource.getRepository(UserTools);
  }

  async findByUserId(userId: string): Promise<UserTools | null> {
    return this.repository.findOneBy({ userId });
  }

  async create(data: Partial<UserTools>): Promise<UserTools> {
    const userTools = this.repository.create(data);
    return this.repository.save(userTools);
  }

  async update(id: string, data: Partial<UserTools>): Promise<UserTools | null> {
    await this.repository.update(id, data);
    return this.repository.findOneBy({ id });
  }

  async updateByUserId(userId: string, data: Partial<UserTools>): Promise<UserTools | null> {
    const userTools = await this.findByUserId(userId);
    
    if (userTools) {
      // 更新现有记录
      await this.repository.update(userTools.id, data);
      return this.repository.findOneBy({ id: userTools.id });
    } else {
      // 创建新记录
      const newUserTools = this.repository.create({
        userId,
        ...data
      });
      return this.repository.save(newUserTools);
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