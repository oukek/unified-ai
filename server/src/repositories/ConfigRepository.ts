import { Repository } from 'typeorm';
import { Config } from '../entities/Config';
import { AppDataSource } from '../db';

export class ConfigRepository {
  private repository: Repository<Config>;

  constructor() {
    this.repository = AppDataSource.getRepository(Config);
  }

  async findAll(): Promise<Config[]> {
    return this.repository.find();
  }

  async findById(id: string): Promise<Config | null> {
    return this.repository.findOneBy({ id });
  }

  async findByUserId(userId: string): Promise<Config[]> {
    return this.repository.findBy({ userId });
  }

  async findByType(type: string): Promise<Config[]> {
    return this.repository.findBy({ type });
  }

  async findByUserIdAndType(userId: string, type: string): Promise<Config | null> {
    return this.repository.findOneBy({ userId, type });
  }

  async create(configData: Partial<Config>): Promise<Config> {
    const config = this.repository.create(configData);
    return this.repository.save(config);
  }

  async update(id: string, configData: Partial<Config>): Promise<Config | null> {
    await this.repository.update(id, configData);
    return this.findById(id);
  }

  async upsertByUserIdAndType(userId: string, type: string, value: string, description?: string): Promise<Config> {
    let config = await this.findByUserIdAndType(userId, type);
    
    if (config) {
      // 如果存在则更新
      config.value = value;
      if (description) {
        config.description = description;
      }
      return this.repository.save(config);
    } else {
      // 如果不存在则创建
      return this.create({
        userId,
        type,
        value,
        description
      });
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return !!result?.affected && result.affected > 0;
  }

  async deleteByUserIdAndType(userId: string, type: string): Promise<boolean> {
    const result = await this.repository.delete({ userId, type });
    return !!result?.affected && result.affected > 0;
  }
} 