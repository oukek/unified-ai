import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

// 设置 dayjs 语言为中文
dayjs.locale('zh-cn')

/**
 * 格式化时间为友好展示
 * @param date 日期对象或日期字符串
 * @returns 格式化后的字符串：今天显示为"HH:mm"，昨天显示为"昨天"，其他显示为"MM/DD"
 */
export function formatTime(date: Date | string): string {
  const dateObj = dayjs(date)
  const now = dayjs()
  
  // 如果是今天，显示时间 HH:mm
  if (dateObj.isSame(now, 'day')) {
    return dateObj.format('HH:mm')
  }
  
  // 如果是昨天，显示"昨天"
  if (dateObj.isSame(now.subtract(1, 'day'), 'day')) {
    return '昨天'
  }
  
  // 否则显示日期 MM/DD
  return dateObj.format('MM/DD')
}

/**
 * 获取会话的时间分类
 * @param date 日期对象或日期字符串
 * @returns 返回时间分类：今天、昨天或具体年月日（YYYY年MM月DD日）
 */
export function getTimeCategory(date: Date | string): string {
  const dateObj = dayjs(date)
  const now = dayjs()
  
  // 如果是今天
  if (dateObj.isSame(now, 'day')) {
    return '今天'
  }
  
  // 如果是昨天
  if (dateObj.isSame(now.subtract(1, 'day'), 'day')) {
    return '昨天'
  }
  
  // 如果是今年
  if (dateObj.isSame(now, 'year')) {
    return dateObj.format('MM月DD日')
  }
  
  // 其他年份
  return dateObj.format('YYYY年MM月DD日')
} 