<template>
  <div class="svg-icon-wrapper" :style="wrapperStyle">
    <component 
      :is="iconComponent" 
      class="svg-icon" 
      :style="iconStyle" 
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, h } from 'vue'

const props = defineProps({
  // 图标名称
  name: {
    type: String,
    required: true
  },
  // 尺寸大小（像素）
  size: {
    type: [Number, String],
    default: 20
  },
  // 图标颜色
  color: {
    type: String,
    default: 'currentColor'  // 默认继承父元素颜色
  },
  // 容器样式
  wrapperClass: {
    type: String,
    default: ''
  }
})

// 动态导入图标组件
const iconComponent = computed(() => {
  return defineAsyncComponent(() => 
    import(`@/assets/icons/${props.name}.svg`)
      .catch((error) => {
        console.error(`图标 ${props.name} 加载失败:`, error)
        // 返回一个简单的备用图标
        return {
          render() {
            return h('svg', { 
              width: '100%', 
              height: '100%', 
              viewBox: '0 0 24 24'
            }, [
              h('rect', { 
                width: 24, 
                height: 24, 
                fill: 'none', 
                stroke: 'currentColor' 
              })
            ]);
          }
        };
      })
  )
})

// 计算图标样式
const iconStyle = computed(() => {
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    color: props.color
  }
})

// 计算容器样式
const wrapperStyle = computed(() => {
  return {
    width: `${props.size}px`,
    height: `${props.size}px`
  }
})
</script>

<style lang="less" scoped>
.svg-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  :deep(.svg-icon) {
    width: 100%;
    height: 100%;
    
    path {
      fill: currentColor;
    }
  }
}
</style> 