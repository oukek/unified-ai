import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

// 主模块和子模块构建配置
export default [
  // 主包配置
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
      },
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          declaration: false,
        },
      }),
    ],
  },

  // models 子模块配置
  {
    input: 'src/models/index.ts',
    output: [
      {
        file: 'dist/models/index.js',
        format: 'cjs',
      },
      {
        file: 'dist/models/index.esm.js',
        format: 'esm',
      },
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          declaration: false,
        },
      }),
    ],
  },

  // 类型声明文件配置 - 主包
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },

  // 类型声明文件配置 - models 子模块
  {
    input: 'src/models/index.ts',
    output: {
      file: 'dist/models/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
]
