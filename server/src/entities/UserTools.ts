import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_tools')
export class UserTools {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'simple-json', nullable: true })
  enabledTools: string[]; // 存储用户启用的工具名称列表

  @Column({ type: 'simple-json', nullable: true })
  toolConfigs: Record<string, any>; // 存储工具配置，如API密钥等

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 