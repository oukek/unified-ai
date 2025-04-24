import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

// 模块列表
const modules = ['']

// 更新 package.json 中的 exports 字段
// function updatePackageExports() {
//   const packageJsonPath = path.resolve('./package.json')

//   if (!fs.existsSync(packageJsonPath)) {
//     console.error('无法找到 package.json 文件')
//     return
//   }

//   const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
//   const newExports = {}

//   // 为每个模块创建 exports 配置
//   modules.forEach((module) => {
//     const exportPath = module ? `./${module}` : '.'
//     newExports[exportPath] = {
//       types: module ? `./dist/${module}/index.d.ts` : './dist/index.d.ts',
//       import: module ? `./dist/${module}/index.esm.js` : './dist/index.esm.js',
//       require: module ? `./dist/${module}/index.js` : './dist/index.js',
//     }
//   })

//   // 更新 package.json
//   packageJson.exports = newExports

//   // 写入文件
//   fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
//   console.log('已更新 package.json 中的 exports 字段')
// }

// 创建基础构建配置
function createBuildConfig(module) {
  const path = module ? `${module}/` : ''
  const input = `src/${path}index.ts`

  return {
    input,
    output: [
      {
        file: `dist/${path}index.js`,
        format: 'cjs',
      },
      {
        file: `dist/${path}index.esm.js`,
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
  }
}

// 创建类型声明文件配置
function createDtsConfig(module) {
  const path = module ? `${module}/` : ''
  const input = `src/${path}index.ts`

  return {
    input,
    output: {
      file: `dist/${path}index.d.ts`,
      format: 'es',
    },
    plugins: [dts()],
  }
}

// 更新 package.json 中的 exports 字段
// updatePackageExports()

// 生成所有配置
const buildConfigs = modules.map(createBuildConfig)
const dtsConfigs = modules.map(createDtsConfig)

// 主模块和子模块构建配置
export default [
  ...buildConfigs,
  ...dtsConfigs,
]
