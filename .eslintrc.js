module.exports = {
  extends: ['expo', 'prettier'],
  plugins: ['@typescript-eslint'],
  rules: {
    'no-console': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
