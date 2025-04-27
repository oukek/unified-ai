import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_mcp')
export class UserMcp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'simple-json', nullable: true })
  enabledMcps: string[]; // 存储用户启用的MCP名称列表

  @Column({ type: 'simple-json', nullable: true })
  mcpConfigs: Record<string, any>; // 存储MCP配置，包含command、args和env等

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 