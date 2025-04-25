import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('configs')
export class Config {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ length: 50 })
  type: string; // 配置类型，如 'model_key', 'tools', 等

  @Column({ type: 'text' })
  value: string; // 配置值，存储为JSON字符串

  @Column({ nullable: true, length: 255 })
  description: string; // 配置描述

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 