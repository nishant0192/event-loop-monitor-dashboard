module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Allow console in Node.js application
    'no-console': 'off',
    
    // Warn on unused vars instead of error
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }],
    
    // Allow async without await
    'require-await': 'off',
    
    // Prefer const
    'prefer-const': 'warn',
    
    // Disallow var
    'no-var': 'warn',
    
    // Require === and !==
    'eqeqeq': ['warn', 'always'],
    
    // No multiple empty lines
    'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],
    
    // Enforce semicolons (adjust based on your preference)
    // 'semi': ['error', 'always'],  // Uncomment if you want semicolons
    
    // Max line length (warning only)
    'max-len': ['warn', { 
      code: 120, 
      ignoreComments: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true
    }],
  },
};