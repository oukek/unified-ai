/// <reference types="vite/client" />

declare module '*.svg' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}
