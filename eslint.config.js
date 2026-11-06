/* eslint.config.js
 *
 * Linting is part of the security posture: it blocks eval, string-built SQL
 * and unsafe DOM writes before code is committed.
 */

const js = require('@eslint/js');
const globals = require('globals');
const security = require('eslint-plugin-security');
const prettier = require('eslint-config-prettier');

module.exports = [
    { ignores: ['node_modules/', 'dist/', 'coverage/', '_to_delete/'] },

    js.configs.recommended,
    security.configs.recommended,

    // Rules for all JavaScript (Node, CommonJS)
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: { ...globals.node }
        },
        rules: {
            eqeqeq: ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            // Too many false positives on ordinary property access. Input is validated
            // against schemas instead (see Step 2 of the Build Guide).
            'security/detect-object-injection': 'off'
        }
    },

    // Server code: never pass an interpolated string straight into a query call.
    // Values must be bound with ? placeholders.
    {
        files: ['private/**/*.js', 'scripts/**/*.js'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        'CallExpression[callee.property.name=/^(query|execute)$/] > TemplateLiteral:first-child[expressions.length>0]',
                    message:
                        'Do not build SQL with template strings. Bind values with ? placeholders.'
                },
                {
                    selector:
                        "CallExpression[callee.property.name=/^(query|execute)$/] > BinaryExpression:first-child[operator='+']",
                    message: 'Do not build SQL by concatenation. Bind values with ? placeholders.'
                }
            ]
        }
    },

    // Scope.PLATFORM reads tenant-owned tables across EVERY restaurant. Only platform (owner)
    // code may use it, so the rest of the app cannot do it by accident.
    {
        files: ['private/**/*.js'],
        ignores: ['private/platform/**', 'private/core/scope.js'],
        rules: {
            'no-restricted-properties': [
                'error',
                {
                    object: 'Scope',
                    property: 'PLATFORM',
                    message:
                        'Scope.PLATFORM is only allowed in private/platform/. Use Scope.tenant(id) or Scope.GLOBAL.'
                }
            ]
        }
    },

    // File paths in these files come from trusted configuration, not from users.
    {
        files: ['scripts/**/*.js', 'private/config/**/*.js'],
        rules: { 'security/detect-non-literal-fs-filename': 'off' }
    },

    // Browser code: no unsafe HTML sinks. Use textContent or createElement.
    {
        files: ['public/js/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            globals: { ...globals.browser }
        },
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
                    message: 'Do not assign HTML strings. Use textContent or createElement.'
                },
                {
                    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
                    message: 'insertAdjacentHTML is banned. Use createElement and append.'
                },
                {
                    selector:
                        "CallExpression[callee.object.name='document'][callee.property.name='write']",
                    message: 'document.write is banned.'
                }
            ]
        }
    },

    // Must come last: turns off stylistic rules that Prettier handles.
    prettier
];
