'use strict'
/**
 * Preview Analyzer
 * - Scans TSX components to determine preview capability, required providers, props, and blockers.
 * - Uses TypeScript compiler API to parse without type-checking (no project load required).
 *
 * Output types (JSDoc):
 * @typedef {Object} PropInfo
 * @property {string} name
 * @property {boolean} required
 * @property {string=} type
 * @property {boolean=} hasDefault
 *
 * @typedef {Object} ExportedComponent
 * @property {string} exportName
 * @property {boolean} returnsJSX
 * @property {PropInfo[]=} props
 * @property {boolean=} propsIncomplete
 *
 * @typedef {Object} PreviewAnalysis
 * @property {string} file
 * @property {('previewable'|'needs_providers'|'blocked')} status
 * @property {string[]} reasons
 * @property {string[]} needs
 * @property {string[]} externalDeps
 * @property {boolean} hasPreviewMeta
 * @property {string[]=} metaNeeds
 * @property {Object<string, any>=} metaRaw
 * @property {ExportedComponent[]} exports
 */

const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const NODE_BUILTINS = new Set([
  'fs',
  'path',
  'os',
  'http',
  'https',
  'zlib',
  'stream',
  'crypto',
  'child_process',
  'worker_threads',
  'electron',
  'node:fs',
  'node:path',
  'node:os',
  'node:http',
  'node:https',
  'node:zlib',
  'node:stream',
  'node:crypto',
  'node:child_process',
])

const PROVIDER_MAP = [
  { test: (m) => m === 'react-router-dom', need: 'router' },
  {
    test: (m) => /renderer\/hooks\/useTheme(\.ts)?$/.test(m) || /useTheme$/.test(m),
    need: 'theme',
  },
  { test: (m) => /renderer\/services\/taskService(\.ts)?$/.test(m), need: 'tasksMock' },
  {
    test: (m) => /renderer\/services\/notificationsService(\.ts)?$/.test(m),
    need: 'notificationsMock',
  },
  {
    test: (m) => /src\/chat\//.test(m) || /renderer\/services\/chatService(\.ts)?$/.test(m),
    need: 'llmMock',
  },
  { test: (m) => /renderer\/preview\//.test(m), need: null }, // preview infra itself, ignore
]

function isJSXPresent(node) {
  let found = false
  function visit(n) {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

function getText(node, sourceFile) {
  return node.getText(sourceFile)
}

function collectTypeMembersFromAliasOrInterface(typeName, sf, typeMap) {
  // typeMap: name -> node for InterfaceDeclaration | TypeAliasDeclaration (type literal)
  const node = typeMap.get(typeName)
  if (!node) return null
  if (ts.isInterfaceDeclaration(node)) {
    const props = []
    node.members.forEach((m) => {
      if (ts.isPropertySignature(m) && m.name && ts.isIdentifier(m.name)) {
        const name = m.name.text
        const optional = !!m.questionToken
        const type = m.type ? m.type.getText(sf) : 'any'
        props.push({ name, required: !optional, type })
      }
    })
    return props
  }
  if (ts.isTypeAliasDeclaration(node) && node.type && ts.isTypeLiteralNode(node.type)) {
    const props = []
    node.type.members.forEach((m) => {
      if (ts.isPropertySignature(m) && m.name && ts.isIdentifier(m.name)) {
        const name = m.name.text
        const optional = !!m.questionToken
        const type = m.type ? m.type.getText(sf) : 'any'
        props.push({ name, required: !optional, type })
      }
    })
    return props
  }
  return null
}

function collectLocalTypeMap(sf) {
  const map = new Map()
  sf.forEachChild((n) => {
    if (ts.isInterfaceDeclaration(n) && n.name) map.set(n.name.text, n)
    if (ts.isTypeAliasDeclaration(n) && n.name) map.set(n.name.text, n)
  })
  return map
}

function analyzeFunctionComponent(fn, sf, typeMap) {
  // Determine props from first parameter
  const propsInfo = []
  let propsIncomplete = false

  if (!fn.parameters || fn.parameters.length === 0) return { props: [], propsIncomplete: false }
  const param = fn.parameters[0]

  // Case 1: Identifier with type annotation
  if (ts.isIdentifier(param.name)) {
    if (param.type) {
      // React.FC<Props> or direct Props
      if (ts.isTypeReferenceNode(param.type) && ts.isIdentifier(param.type.typeName)) {
        const typeName = param.type.typeName.text
        const localProps = collectTypeMembersFromAliasOrInterface(typeName, sf, typeMap)
        if (localProps) {
          return { props: localProps, propsIncomplete: false }
        }
        // Unknown external type
        return { props: [], propsIncomplete: true }
      }
      if (ts.isTypeLiteralNode(param.type)) {
        const props = []
        param.type.members.forEach((m) => {
          if (ts.isPropertySignature(m) && m.name && ts.isIdentifier(m.name)) {
            const name = m.name.text
            const optional = !!m.questionToken
            const type = m.type ? m.type.getText(sf) : 'any'
            props.push({ name, required: !optional, type })
          }
        })
        return { props, propsIncomplete: false }
      }
      // Other types (any, unknown, union) – incomplete
      return { props: [], propsIncomplete: true }
    }
    // No type annotation – incomplete
    return { props: [], propsIncomplete: true }
  }

  // Case 2: Object binding pattern (destructuring)
  if (ts.isObjectBindingPattern(param.name)) {
    const props = []
    param.name.elements.forEach((el) => {
      const name = ts.isIdentifier(el.name) ? el.name.text : getText(el.name, sf)
      // default value means not required
      const hasDefault = !!el.initializer
      props.push({ name, required: !hasDefault, hasDefault })
    })
    // Might still be incomplete if type is external
    const incomplete = !param.type || (param.type && !ts.isTypeLiteralNode(param.type))
    return { props, propsIncomplete: incomplete }
  }

  return { props: [], propsIncomplete: true }
}

function analyzeExports(sf, checkerless = true) {
  const typeMap = collectLocalTypeMap(sf)
  const exports = []

  // Default export function declaration
  sf.forEachChild((n) => {
    if (
      ts.isFunctionDeclaration(n) &&
      n.modifiers &&
      n.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    ) {
      const name = n.name ? n.name.text : 'default'
      const jsx = isJSXPresent(n)
      const { props, propsIncomplete } = analyzeFunctionComponent(n, sf, typeMap)
      exports.push({ exportName: 'default', returnsJSX: jsx, props, propsIncomplete })
    }
  })

  // Export assignment: export default Identifier
  sf.forEachChild((n) => {
    if (ts.isExportAssignment(n)) {
      const expr = n.expression
      let jsx = false
      let props = []
      let propsIncomplete = true
      if (ts.isFunctionExpression(expr) || ts.isArrowFunction(expr)) {
        jsx = isJSXPresent(expr)
        const res = analyzeFunctionComponent(expr, sf, typeMap)
        props = res.props
        propsIncomplete = res.propsIncomplete
      }
      exports.push({ exportName: 'default', returnsJSX: jsx, props, propsIncomplete })
    }
  })

  // Named exported variables or functions
  sf.forEachChild((n) => {
    if (
      ts.isVariableStatement(n) &&
      n.modifiers &&
      n.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      n.declarationList.declarations.forEach((d) => {
        const name = ts.isIdentifier(d.name) ? d.name.text : 'anonymous'
        let jsx = false
        let props = []
        let propsIncomplete = true
        if (
          d.initializer &&
          (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))
        ) {
          jsx = isJSXPresent(d.initializer)
          const res = analyzeFunctionComponent(d.initializer, sf, typeMap)
          props = res.props
          propsIncomplete = res.propsIncomplete
        }
        exports.push({ exportName: name, returnsJSX: jsx, props, propsIncomplete })
      })
    }
    if (
      ts.isFunctionDeclaration(n) &&
      n.modifiers &&
      n.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      const name = n.name ? n.name.text : 'anonymous'
      const jsx = isJSXPresent(n)
      const { props, propsIncomplete } = analyzeFunctionComponent(n, sf, typeMap)
      exports.push({ exportName: name, returnsJSX: jsx, props, propsIncomplete })
    }
  })

  return exports
}

function readPreviewMeta(sf) {
  let meta = null
  sf.forEachChild((n) => {
    if (ts.isVariableStatement(n)) {
      const isExport =
        n.modifiers && n.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (!isExport) return
      n.declarationList.declarations.forEach((d) => {
        if (
          ts.isIdentifier(d.name) &&
          d.name.text === 'preview' &&
          d.initializer &&
          ts.isObjectLiteralExpression(d.initializer)
        ) {
          // Attempt a naive extraction for `needs` array literal
          const obj = {}
          d.initializer.properties.forEach((p) => {
            if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
              const key = p.name.text
              if (key === 'needs' && ts.isArrayLiteralExpression(p.initializer)) {
                obj.needs = p.initializer.elements.filter(ts.isStringLiteral).map((el) => el.text)
              } else if (ts.isStringLiteral(p.initializer) || ts.isNumericLiteral(p.initializer)) {
                obj[key] = p.initializer.text
              } else if (ts.isTrueFalseKeyword(p.initializer && p.initializer.kind)) {
                obj[key] = p.initializer.kind === ts.SyntaxKind.TrueKeyword
              } else {
                // fallback text
                obj[key] = p.initializer.getText(sf)
              }
            }
          })
          meta = obj
        }
      })
    }
  })
  return meta
}

function analyzeImports(sf) {
  const deps = []
  sf.forEachChild((n) => {
    if (ts.isImportDeclaration(n)) {
      const moduleName =
        n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) ? n.moduleSpecifier.text : null
      if (moduleName) deps.push(moduleName)
    }
  })
  return deps
}

function mapNeedsFromDeps(deps) {
  const needs = new Set()
  deps.forEach((m) => {
    // Node/Electron blockers
    if (NODE_BUILTINS.has(m) || m.startsWith('node:')) {
      needs.add('blocked:node_builtin')
      return
    }
    if (m === 'electron' || m.startsWith('electron/')) {
      needs.add('blocked:electron')
      return
    }
    // Heuristic providers
    for (const rule of PROVIDER_MAP) {
      if (rule.test(m)) {
        if (rule.need) needs.add(rule.need)
      }
    }
  })
  return Array.from(needs)
}

/**
 * Analyze a single TSX component file.
 * @param {string} filePath absolute or relative path
 * @returns {PreviewAnalysis}
 */
function analyzeFile(filePath) {
  const abs = path.resolve(filePath)
  const source = fs.readFileSync(abs, 'utf8')
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  const externalDeps = analyzeImports(sf)
  const mappedNeeds = mapNeedsFromDeps(externalDeps)
  const previewMeta = readPreviewMeta(sf)
  const exports = analyzeExports(sf)

  const reasons = []
  let status = 'previewable'
  const needs = new Set()

  // Apply needs from deps
  for (const n of mappedNeeds) {
    if (n.startsWith('blocked:')) continue
    needs.add(n)
  }

  // Blockers
  if (mappedNeeds.includes('blocked:electron')) {
    status = 'blocked'
    reasons.push('Imports electron APIs that are not available in browser preview.')
  }
  if (mappedNeeds.includes('blocked:node_builtin')) {
    status = 'blocked'
    reasons.push('Imports Node.js built-in modules that are not available in browser preview.')
  }

  // Determine if any export returns JSX; otherwise not a visual component
  const anyJSX = exports.some((e) => e.returnsJSX)
  if (!anyJSX) {
    status = 'blocked'
    reasons.push('No JSX-returning component export detected.')
  }

  // Props completeness hints
  const anyIncomplete = exports.some((e) => e.propsIncomplete)
  if (status !== 'blocked' && anyIncomplete) {
    reasons.push(
      'Props type could not be fully inferred (external or implicit). Provide props via preview URL or export a preview meta.',
    )
  }

  // Apply preview meta
  let hasPreviewMeta = false
  let metaNeeds = undefined
  let metaRaw = undefined
  if (previewMeta) {
    hasPreviewMeta = true
    metaRaw = previewMeta
    if (Array.isArray(previewMeta.needs)) {
      metaNeeds = previewMeta.needs
      previewMeta.needs.forEach((n) => needs.add(n))
    }
  }

  // If needs present and not blocked, classify as needs_providers
  if (status !== 'blocked' && needs.size > 0) {
    status = 'needs_providers'
    reasons.push(`Requires providers/mocks: ${Array.from(needs).join(', ')}`)
  }

  return {
    file: path.relative(process.cwd(), abs),
    status,
    reasons,
    needs: Array.from(needs),
    externalDeps,
    hasPreviewMeta,
    metaNeeds,
    metaRaw,
    exports,
  }
}

/**
 * Recursively find .tsx files under given directory.
 * @param {string} dir
 * @returns {string[]}
 */
function findTsxFiles(dir) {
  const results = []
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        // Skip node_modules and build dirs
        if (
          e.name === 'node_modules' ||
          e.name.startsWith('.') ||
          e.name === 'dist' ||
          e.name === 'build'
        )
          continue
        stack.push(p)
      } else if (e.isFile()) {
        if (p.endsWith('.tsx')) results.push(p)
      }
    }
  }
  return results
}

/**
 * Analyze a directory for previewable components.
 * @param {string} dir
 * @returns {Object}
 */
function analyzeDirectory(dir) {
  const files = findTsxFiles(dir)
  const analyses = files.map((f) => analyzeFile(f))
  const summary = {
    scanned: files.length,
    previewable: analyses.filter((a) => a.status === 'previewable').length,
    needs_providers: analyses.filter((a) => a.status === 'needs_providers').length,
    blocked: analyses.filter((a) => a.status === 'blocked').length,
  }
  return { summary, analyses }
}

module.exports = {
  analyzeFile,
  analyzeDirectory,
  findTsxFiles,
}
