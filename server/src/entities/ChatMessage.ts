import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// 定义内容块类型，用于存储文本和工具调用
export interface ContentBlock {
  type: 'text' | 'tool'; // 文本块或工具调用块
  content?: string; // 文本内容
  data?: any; // 工具调用数据
}

// 定义函数调用类型
export interface FunctionCall {
  id?: string; // 用于标识和展开/折叠状态跟踪
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({
    type: 'varchar',
    length: 50
  })
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'simple-json', nullable: true })
  blocks: ContentBlock[];

  @Column({ type: 'simple-json', nullable: true })
  functionCalls: FunctionCall[];

  @CreateDateColumn()
  timestamp: Date;
} 