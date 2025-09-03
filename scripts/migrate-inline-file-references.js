const fs = require('fs');
const path = require('path');

function listTaskJsonFiles(tasksDir) {
  return fs.readdirSync(tasksDir)
    .map((d) => path.join(tasksDir, d, 'task.json'))
    .filter((p) => fs.existsSync(p) && fs.statSync(p).isFile());
}

function replaceInline(text) {
  if (typeof text !== 'string') return text;
  let out = text;
  // 1) backticked paths or filenames
  out = out.replace(/`([^`\n]+?\.[A-Za-z0-9]+)`/g, (m, p1) => `@${p1}`);
  // 2) bare filenames with common code extensions (tsx|ts|js|jsx|css|md|json)
  out = out.replace(/(^|\s)([A-Za-z0-9_\-]+\.(?:tsx|ts|js|jsx|css|md|json))(?![A-Za-z0-9_.\-])/g, (m, pre, file) => `${pre}@${file}`);
  return out;
}

function processJsonFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  let data;
  try { data = JSON.parse(src); } catch (e) {
    console.error('Failed to parse', filePath, e.message);
    return;
  }
  // update top-level fields
  ['title','description','plan'].forEach((k) => { if (data[k]) data[k] = replaceInline(data[k]); });
  // features
  if (Array.isArray(data.features)) {
    data.features.forEach((f) => {
      ['title','description','plan'].forEach((k) => { if (f[k]) f[k] = replaceInline(f[k]); });
      if (Array.isArray(f.acceptance)) {
        f.acceptance = f.acceptance.map((a) => typeof a === 'string' ? replaceInline(a) : a);
      }
    });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log('Updated', filePath);
}

function main(){
  const tasksDir = path.join(process.cwd(), 'tasks');
  if (!fs.existsSync(tasksDir)) {
    console.error('tasks directory not found');
    process.exit(1);
  }
  const files = listTaskJsonFiles(tasksDir);
  files.forEach(processJsonFile);
}

if (require.main === module) main();
