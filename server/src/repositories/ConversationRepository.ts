import { Repository } from 'typeorm';
import { Conversation } from '../entities/Conversation';
import { AppDataSource } from '../db';

export class ConversationRepository {
  private repository: Repository<Conversation>;

  constructor() {
    this.repository = AppDataSource.getRepository(Conversation);
  }

  async findAll(): Promise<Conversation[]> {
    return this.repository.find();
  }

  async findById(id: string): Promise<Conversation | null> {
    return this.repository.findOneBy({ id });
  }

  async findByUserId(userId: string): Promise<Conversation[]> {
    return this.repository.findBy({ userId });
  }

  async create(data: Partial<Conversation>): Promise<Conversation> {
    const conversation = this.repository.create(data);
    return this.repository.save(conversation);
  }

  async update(id: string, data: Partial<Conversation>): Promise<Conversation | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return !!result?.affected && result.affected > 0;
  }

  async countUserConversations(userId: string): Promise<number> {
    return this.repository.countBy({ userId });
  }

  async findLatestByUserId(userId: string, limit: number = 10): Promise<Conversation[]> {
    return this.repository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: limit
    });
  }
} 