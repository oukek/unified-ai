import { Repository } from 'typeorm';
import { ChatMessage } from '../entities/ChatMessage';
import { AppDataSource } from '../db';

export class ChatMessageRepository {
  private repository: Repository<ChatMessage>;

  constructor() {
    this.repository = AppDataSource.getRepository(ChatMessage);
  }

  async findById(id: string): Promise<ChatMessage | null> {
    return this.repository.findOneBy({ id });
  }

  async findByConversationId(conversationId: string): Promise<ChatMessage[]> {
    return this.repository.find({
      where: { conversationId },
      order: { timestamp: 'ASC' } // 按时间顺序排序
    });
  }

  async create(data: Partial<ChatMessage>): Promise<ChatMessage> {
    const message = this.repository.create(data);
    return this.repository.save(message);
  }

  async update(id: string, data: Partial<ChatMessage>): Promise<ChatMessage | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return !!result?.affected && result.affected > 0;
  }

  async deleteByConversationId(conversationId: string): Promise<boolean> {
    const result = await this.repository.delete({ conversationId });
    return !!result?.affected && result.affected > 0;
  }
  
  async countMessages(conversationId: string): Promise<number> {
    return this.repository.countBy({ conversationId });
  }

  async getLastMessage(conversationId: string): Promise<ChatMessage | null> {
    const messages = await this.repository.find({
      where: { conversationId },
      order: { timestamp: 'DESC' },
      take: 1
    });
    
    return messages.length > 0 ? messages[0] : null;
  }
} 