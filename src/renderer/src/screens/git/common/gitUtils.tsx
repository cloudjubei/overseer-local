export function getFilePatch(diffPatch: string | undefined, path: string): string | undefined {
  if (!diffPatch) return undefined
  const blocks = diffPatch.split('\ndiff --git ')
  for (let i = 0; i < blocks.length; i++) {
    let block = blocks[i]
    if (i === 0) {
      if (!block.startsWith('diff --git ')) continue
      block = block.slice('diff --git '.length)
    }
    if (
      block.includes(` b/${path}\n`) ||
      block.includes(` b/${path}\r\n`) ||
      block.startsWith(`a/${path} b/${path}\n`)
    ) {
      return `diff --git ${block}`
    }
  }
  return undefined
}
