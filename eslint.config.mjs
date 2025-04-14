import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  stylistic: {
    indent: 2,
    quotes: 'single',
  },
  typescript: true,
  ignores: [
    'README.md',
  ],
}, {
  rules: {
    'no-console': 'off',
    'no-case-declarations': 'off',
    'jsdoc/check-param-names': 'off',
    'ts/explicit-function-return-type': 'off',
  },
})
