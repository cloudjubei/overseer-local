/* eslint-disable no-console */
'use strict'

const fs = require('fs')
const path = require('path')
const cp = require('child_process')

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`)
  cp.execSync(cmd, { stdio: 'inherit', ...opts })
}

function runCapture(cmd, opts = {}) {
  const out = cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], ...opts })
  return out.toString().trim()
}

function packToVendor(pkgDir, vendorDir) {
  // Prefer JSON output for robust parsing
  let filename
  try {
    const json = runCapture('npm pack --json', { cwd: pkgDir })
    const arr = JSON.parse(json)
    filename = Array.isArray(arr) && arr.length > 0 ? arr[0].filename : arr.filename
  } catch (_) {
    // Fallback: npm pack returns filename on stdout
    filename = runCapture('npm pack', { cwd: pkgDir }).split(/\r?\n/).pop()
  }
  if (!filename) throw new Error(`Failed to pack: ${pkgDir}`)

  const src = path.join(pkgDir, filename)
  const dst = path.join(vendorDir, filename)
  fs.copyFileSync(src, dst)
  console.log(`Packed ${pkgDir} -> vendor/${filename}`)
  return filename
}

function main() {
  const platform = (process.argv[2] || '').toLowerCase()
  const targets = { mac: '--mac', win: '--win', windows: '--win', linux: '--linux' }
  const builderArg = targets[platform]
  if (!builderArg) {
    console.error('Usage: node scripts/vendorize.js <mac|win|linux>')
    process.exit(1)
  }

  const projectRoot = process.cwd()
  const pkgPath = path.join(projectRoot, 'package.json')
  const backupPath = path.join(projectRoot, 'package.json.vendored-backup.json')
  const vendorDir = path.join(projectRoot, 'vendor')
  fs.mkdirSync(vendorDir, { recursive: true })

  const original = fs.readFileSync(pkgPath, 'utf8')
  const pkg = JSON.parse(original)
  fs.writeFileSync(backupPath, original)

  const depSources = pkg.dependencies || {}
  const devDepSources = pkg.devDependencies || {}
  const vendored = {}

  function resolveLocalPath(spec) {
    if (!spec || !spec.startsWith('file:')) return null
    const rel = spec.replace(/^file:/, '')
    return path.resolve(projectRoot, rel)
  }

  const modules = ['thefactory-db', 'thefactory-tools']
  try {
    // Clean vendor dir of old tgz for clarity (optional)
    for (const f of fs.readdirSync(vendorDir)) {
      if (f.endsWith('.tgz')) {
        try { fs.unlinkSync(path.join(vendorDir, f)) } catch (_) {}
      }
    }

    // Create tgz for each local module and rewrite deps to vendored tgz
    for (const name of modules) {
      const spec = depSources[name] || devDepSources[name]
      if (!spec) throw new Error(`Dependency not found in package.json: ${name}`)
      const localPath = resolveLocalPath(spec)
      if (!localPath || !fs.existsSync(localPath)) {
        throw new Error(`Local path for ${name} is not accessible: ${spec}`)
      }
      const filename = packToVendor(localPath, vendorDir)
      vendored[name] = `file:./vendor/${filename}`
    }

    pkg.dependencies = pkg.dependencies || {}
    for (const [name, fileSpec] of Object.entries(vendored)) {
      pkg.dependencies[name] = fileSpec
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    // Install vendored deps
    run('npm install --no-audit --no-fund', { cwd: projectRoot })

    // Build app code and package for target
    run('npm run build', { cwd: projectRoot })
    run(`npx electron-builder ${builderArg}`, { cwd: projectRoot })
  } catch (err) {
    console.error('\nVendorized build failed:', err && err.message ? err.message : err)
    process.exitCode = 1
  } finally {
    // Restore original package.json and dev install
    try {
      fs.writeFileSync(pkgPath, original)
      console.log('package.json restored.')
      run('npm install --no-audit --no-fund', { cwd: projectRoot })
    } catch (e) {
      console.error('Failed to restore dev dependencies:', e && e.message ? e.message : e)
    }
    // Optionally keep the vendored tgz files for reuse
  }
}

main()
