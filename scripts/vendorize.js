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

function fileExists(p) {
  try { fs.accessSync(p); return true } catch (_) { return false }
}

function rimrafSync(p) {
  try { if (fileExists(p)) fs.rmSync(p, { recursive: true, force: true }) } catch (_) {}
}

function requireResolves(projectRoot, spec) {
  try {
    const script = `try{require.resolve('${spec}');process.stdout.write('ok')}catch(e){process.stdout.write('')}`
    const out = cp.execSync(`node -e "${script}"`, { cwd: projectRoot })
    return out.toString() === 'ok'
  } catch (_) {
    return false
  }
}

function prebuildPackage(pkgDir) {
  const pkgJsonPath = path.join(pkgDir, 'package.json')
  if (!fileExists(pkgJsonPath)) throw new Error(`package.json not found in ${pkgDir}`)
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))

  // Ensure deps for build are installed and build artifacts are fresh
  run('npm ci --no-audit --no-fund', { cwd: pkgDir })
  if (pkg.scripts && pkg.scripts.build) {
    run('npm run build', { cwd: pkgDir })
  } else {
    throw new Error(`No build script in ${pkgDir}. Please add one.`)
  }

  // Verify that main entry exists inside dist
  const mainRel = pkg.main || 'dist/index.js'
  const mainAbs = path.join(pkgDir, mainRel)
  if (!fileExists(mainAbs)) {
    throw new Error(`Missing build entry in ${pkgDir}: ${mainRel}`)
  }
  return { pkg, mainRel }
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
  // Remove original tarball to avoid confusion
  try { fs.unlinkSync(src) } catch (_) {}
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
  const lockPath = path.join(projectRoot, 'package-lock.json')
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
    // Clean vendor dir of old tgz for clarity
    for (const f of fs.readdirSync(vendorDir)) {
      if (f.endsWith('.tgz')) { try { fs.unlinkSync(path.join(vendorDir, f)) } catch (_) {} }
    }

    // Prebuild and pack each local module
    for (const name of modules) {
      const spec = depSources[name] || devDepSources[name]
      if (!spec) throw new Error(`Dependency not found in package.json: ${name}`)
      const localPath = resolveLocalPath(spec)
      if (!localPath || !fs.existsSync(localPath)) {
        throw new Error(`Local path for ${name} is not accessible: ${spec}`)
      }

      // Prebuild package and verify main
      prebuildPackage(localPath)

      // Pack to vendor
      const filename = packToVendor(localPath, vendorDir)
      vendored[name] = `file:./vendor/${filename}`
    }

    // Rewrite app dependencies to vendored tgz specs
    pkg.dependencies = pkg.dependencies || {}
    for (const [name, fileSpec] of Object.entries(vendored)) {
      pkg.dependencies[name] = fileSpec
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    // Fresh install in vendor mode to avoid incomplete node_modules
    rimrafSync(lockPath)
    rimrafSync(path.join(projectRoot, 'node_modules'))
    try { run('npm cache clean --force', { cwd: projectRoot }) } catch (_) {}
    run('npm install --no-audit --no-fund', { cwd: projectRoot })

    // If sharp is present, verify its key transitives resolve before building
    const hasSharp = requireResolves(projectRoot, 'sharp/package.json')
    if (hasSharp) {
      const mustResolve = [
        'sharp/package.json',
        'color/package.json',
        'color-convert/package.json',
        'color-name/package.json'
      ]
      for (const mod of mustResolve) {
        if (!requireResolves(projectRoot, mod)) {
          throw new Error(`Vendor install incomplete: cannot resolve ${mod}. Try cleaning node_modules and re-running vendor build.`)
        }
      }
    }

    // Build app code and package for target
    run('npm run build', { cwd: projectRoot })
    run(`npx electron-builder ${builderArg}`, { cwd: projectRoot })
  } catch (err) {
    console.error('\nVendorized build failed:', err && err.message ? err.message : err)
    process.exitCode = 1
  } finally {
    // Restore original package.json and dev install (clean restore)
    try {
      fs.writeFileSync(pkgPath, original)
      console.log('package.json restored.')

      // Always remove lockfile and node_modules to ensure a clean reinstall
      rimrafSync(lockPath)
      rimrafSync(path.join(projectRoot, 'node_modules'))

      // Fresh install for dev state
      run('npm install --no-audit --no-fund', { cwd: projectRoot })
    } catch (e) {
      console.error('Failed to restore dev dependencies:', e && e.message ? e.message : e)
    }
    // Vendored tgz files are kept in vendor/ for reuse
  }
}

main()
