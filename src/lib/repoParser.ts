import JSZip from 'jszip'

export interface RepoFile {
  path: string
  content: string
}

const EXCLUDED_DIRS = [
  'node_modules/', '.git/', 'dist/', 'build/', '.next/', '.nuxt/',
  '__pycache__/', '.venv/', 'venv/', '.tox/', '.mypy_cache/',
  'vendor/', 'target/', 'bin/', 'obj/', '.gradle/', '.idea/',
  '.vscode/', '.vs/', 'coverage/', '.nyc_output/', '.cache/',
]

const EXCLUDED_FILES = [
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Gemfile.lock',
  'Cargo.lock', 'composer.lock', 'poetry.lock', 'Pipfile.lock',
  '.DS_Store', 'Thumbs.db',
]

const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.rb',
  '.php', '.c', '.cpp', '.cs', '.swift', '.kt', '.html', '.css',
  '.json', '.yaml', '.yml', '.md', '.sql', '.sh', '.bash',
  '.dockerfile', '.toml', '.cfg', '.ini', '.env.example',
  '.graphql', '.gql', '.vue', '.svelte', '.astro',
])

const ENTRY_FILES = new Set([
  'index', 'main', 'app', 'server', 'cli', 'mod', 'lib',
])

const MAX_FILE_SIZE = 100 * 1024 // 100KB
const MAX_TOTAL_SIZE = 500 * 1024 // 500KB

function isCodeFile(path: string): boolean {
  const filename = path.split('/').pop() || ''
  const lower = filename.toLowerCase()

  if (lower === 'dockerfile' || lower === 'makefile' || lower === 'rakefile') return true

  const ext = '.' + lower.split('.').pop()
  return CODE_EXTENSIONS.has(ext)
}

function isExcluded(path: string): boolean {
  const lowerPath = path.toLowerCase()
  for (const dir of EXCLUDED_DIRS) {
    if (lowerPath.includes(dir)) return true
  }
  const filename = path.split('/').pop() || ''
  return EXCLUDED_FILES.includes(filename)
}

function priorityScore(path: string): number {
  const filename = (path.split('/').pop() || '').toLowerCase()
  const nameNoExt = filename.replace(/\.[^.]+$/, '')

  // Config files first
  if (['package.json', 'tsconfig.json', 'pyproject.toml', 'cargo.toml', 'go.mod'].includes(filename)) return 0
  // README
  if (filename.startsWith('readme')) return 1
  // Entry files
  if (ENTRY_FILES.has(nameNoExt)) return 2
  // Root-level files
  if (!path.includes('/')) return 3
  // Everything else alphabetical
  return 4
}

function sortFiles(files: RepoFile[]): RepoFile[] {
  return files.sort((a, b) => {
    const pa = priorityScore(a.path)
    const pb = priorityScore(b.path)
    if (pa !== pb) return pa - pb
    return a.path.localeCompare(b.path)
  })
}

function trimToLimit(files: RepoFile[]): RepoFile[] {
  const result: RepoFile[] = []
  let total = 0
  for (const file of files) {
    if (total + file.content.length > MAX_TOTAL_SIZE) {
      const remaining = MAX_TOTAL_SIZE - total
      if (remaining > 200) {
        result.push({ path: file.path, content: file.content.slice(0, remaining) + '\n// ... truncated' })
      }
      break
    }
    result.push(file)
    total += file.content.length
  }
  return result
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'github.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') }
  } catch {
    return null
  }
}

export async function fetchGitHubRepo(
  owner: string,
  repo: string,
  signal?: AbortSignal
): Promise<RepoFile[]> {
  // Step 1: Get repo metadata to find the default branch
  const repoRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    { signal }
  )

  if (repoRes.status === 404) {
    throw new Error('This repository appears to be private or does not exist. Only public repos are supported.')
  }
  if (repoRes.status === 403) {
    throw new Error('GitHub API rate limit exceeded. Please try again later.')
  }
  if (!repoRes.ok) {
    throw new Error(`GitHub API error: ${repoRes.status}`)
  }

  const repoData = await repoRes.json()
  const defaultBranch: string = repoData.default_branch || 'main'

  if (signal?.aborted) throw new Error('Aborted')

  // Step 2: Get file tree using the actual default branch
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { signal }
  )

  if (!treeRes.ok) {
    throw new Error(`Failed to fetch repository file tree. Status: ${treeRes.status}`)
  }

  const treeData = await treeRes.json()
  const tree: Array<{ path: string; type: string; size: number }> = treeData.tree || []

  // Filter to code files
  const codeFiles = tree.filter(
    (item) => item.type === 'blob' && !isExcluded(item.path) && isCodeFile(item.path) && item.size <= MAX_FILE_SIZE
  )

  if (codeFiles.length === 0) {
    throw new Error('No code files found in this repository.')
  }

  // Sort by priority and limit
  const sorted = codeFiles.sort((a, b) => {
    const pa = priorityScore(a.path)
    const pb = priorityScore(b.path)
    if (pa !== pb) return pa - pb
    return a.path.localeCompare(b.path)
  })

  // Step 3: Fetch file contents using the actual default branch
  const filesToFetch = sorted.slice(0, 30)
  const files: RepoFile[] = []

  for (const file of filesToFetch) {
    if (signal?.aborted) throw new Error('Aborted')

    try {
      const rawRes = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${file.path}`,
        { signal }
      )
      if (rawRes.ok) {
        const content = await rawRes.text()
        files.push({ path: file.path, content })
      }
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error('Aborted')
      // Skip failed files
    }
  }

  if (files.length === 0) {
    throw new Error('Could not fetch any code files from this repository.')
  }

  return trimToLimit(sortFiles(files))
}

export async function parseZipFile(file: File, signal?: AbortSignal): Promise<RepoFile[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const files: RepoFile[] = []

  const entries = Object.entries(zip.files).filter(
    ([path, entry]) => !entry.dir && !isExcluded(path) && isCodeFile(path)
  )

  for (const [path, entry] of entries) {
    if (signal?.aborted) throw new Error('Aborted')

    const content = await entry.async('string')
    if (content.length <= MAX_FILE_SIZE) {
      // Strip common root prefix
      const cleanPath = path.replace(/^[^/]+\//, '')
      files.push({ path: cleanPath || path, content })
    }
  }

  if (files.length === 0) {
    throw new Error('No code files found in the ZIP archive.')
  }

  return trimToLimit(sortFiles(files))
}
