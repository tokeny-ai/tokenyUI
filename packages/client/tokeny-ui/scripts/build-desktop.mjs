/** Build the desktop-compatible plugin without changing the legacy workspace package. */
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { build } from 'tsdown'
import { transform } from 'lightningcss'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(packageRoot, '../../..')
const output = resolve(repositoryRoot, '.artifacts/tokenyUI/desktop-package')
const artifactRoot = dirname(output)
const pluginId = '@tokeny-ai/dsh-client-tokeny-ui'
const version = '0.2.2-rc.1-tokeny.6'
const virtualCss = '\0tokeny-css:'
const virtualCssSuffix = '.mjs'
const virtualImage = '\0tokeny-image:'
const externals = new Set()

await mkdir(resolve(output, 'lib'), { recursive: true })

await build({
  config: false,
  cwd: packageRoot,
  entry: { client: 'src/desktop/index.ts' },
  outDir: resolve(output, 'lib'),
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false,
  sourcemap: true,
  deps: {
    neverBundle: [
      /^@deepseek-ai\//,
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
    ],
    alwaysBundle: id => !id.startsWith('@deepseek-ai/') && !/^react(?:-dom)?(?:\/|$)/.test(id),
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'tokeny-desktop-public-imports',
    resolveId(source) {
      if (source.startsWith('@deepseek-ai/')) {
        if (source.includes('/src/')) throw new Error(`Private package import: ${source}`)
        externals.add(source)
        return { id: source, external: true }
      }
      return null
    },
    generateBundle(_options, files) {
      for (const file of Object.values(files)) {
        if (file.type !== 'chunk') continue
        for (const id of file.imports) {
          if (id.includes('/src/')) throw new Error(`Private package import: ${id}`)
          if (id.startsWith('@deepseek-ai/')) externals.add(id)
        }
      }
    },
  }, {
    name: 'tokeny-desktop-images',
    resolveId(source, importer) {
      if (!/\.(png|webp)$/.test(source)) return null
      return virtualImage + resolve(dirname(importer), source)
    },
    async load(id) {
      if (!id.startsWith(virtualImage)) return null
      const file = id.slice(virtualImage.length)
      const mime = file.endsWith('.webp') ? 'image/webp' : 'image/png'
      const data = (await readFile(file)).toString('base64')
      return `export default ${JSON.stringify(`data:${mime};base64,${data}`)};`
    },
  }, {
    name: 'tokeny-desktop-css-modules',
    resolveId(source, importer) {
      if (!source.endsWith('.module.css')) return null
      return virtualCss + resolve(dirname(importer), source) + virtualCssSuffix
    },
    async load(id) {
      if (!id.startsWith(virtualCss)) return null
      const file = id.slice(virtualCss.length, -virtualCssSuffix.length)
      const result = transform({ filename: file, code: await readFile(file), cssModules: { pattern: '[hash]_[local]' }, minify: true })
      const classes = Object.fromEntries(Object.entries(result.exports ?? {}).map(([key, value]) => [key, value.name]))
      const tagId = `${pluginId}/${basename(file)}`
      return `const tagId=${JSON.stringify(tagId)};
if(typeof document!== 'undefined' && document.querySelector('style[data-plugin-css='+JSON.stringify(tagId)+']')===null){
 const tag=document.createElement('style');
 tag.dataset.plugin=${JSON.stringify(pluginId)};
 tag.dataset.pluginCss=tagId;
 tag.textContent=${JSON.stringify(result.code.toString())};
 document.head.appendChild(tag);
}
export default ${JSON.stringify(classes)};`
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({id:${JSON.stringify(pluginId)},factory:(require)=>{`,
    intro: 'var module={exports:{}};var exports=module.exports;',
    footer: 'return module.exports;}});',
  },
})

await build({
  config: false,
  cwd: packageRoot,
  entry: { index: 'src/desktop/host.ts', invariant: 'src/invariant.ts' },
  outDir: resolve(output, 'lib'),
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  dts: false,
  clean: false,
  outputOptions: { entryFileNames: '[name].js' },
})

const injectedPackages = [
  '@deepseek-ai/dsh-api-workspace-files',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-session',
  '@deepseek-ai/dsh-client-ui-workspace',
  '@deepseek-ai/dsh-client-ui-theme',
  '@deepseek-ai/dsh-client-ui-sidebar-right',
  ...Array.from(externals).filter(id => id.startsWith('@deepseek-ai/dsh-client-')).map(id => id.replace(/\/client$/, '')),
]
const manifest = {
  name: pluginId,
  version,
  description: 'Tokeny workspace layout for DeepSeek Harness desktop 0.2.2-rc.1, retaining official branding',
  type: 'module',
  license: 'MIT',
  main: 'lib/index.js',
  exports: {
    '.': './lib/index.js',
    './client': './lib/client.js',
    './invariant': './lib/invariant.js',
    './cordis.patch.yml': './cordis.patch.yml',
    './package.json': './package.json',
  },
  dsh: {
    bundle: { patch: './cordis.patch.yml' },
    client: { platform: 'web', inject: [...new Set(injectedPackages)].sort() },
  },
  peerDependencies: { '@deepseek-ai/cordis': '~4.1.0' },
  peerDependenciesMeta: { '@deepseek-ai/cordis': { optional: true } },
  files: ['lib', 'cordis.patch.yml', 'README.md', 'README.zh.md', 'src', 'scripts'],
}
await writeFile(resolve(output, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
await cp(resolve(packageRoot, 'cordis.patch.yml'), resolve(output, 'cordis.patch.yml'))
await cp(resolve(packageRoot, 'src/desktop'), resolve(output, 'src/desktop'), { recursive: true })
await mkdir(resolve(output, 'src/client'), { recursive: true })
for (const name of ['locales.ts', 'theme.ts']) {
  await cp(resolve(packageRoot, 'src/client', name), resolve(output, 'src/client', name))
}
await cp(resolve(packageRoot, 'src/invariant.ts'), resolve(output, 'src/invariant.ts'))
await cp(resolve(packageRoot, 'src/css-modules.d.ts'), resolve(output, 'src/css-modules.d.ts'))
await cp(resolve(packageRoot, 'scripts'), resolve(output, 'scripts'), { recursive: true })
for (const name of ['README.md', 'README.zh.md']) {
  const source = await readFile(resolve(packageRoot, 'src/desktop', name), 'utf8')
  const relocated = source.replace(/\]\(([^)]+)\)/g, (link, target) => {
    if (target.startsWith('#') || /^[a-z]+:/i.test(target) || /^README(?:\.zh)?\.md$/.test(target)) return link
    const [file, anchor] = target.split('#')
    const path = relative(packageRoot, resolve(packageRoot, 'src/desktop', file)).replaceAll('\\', '/')
    return `](${path}${anchor === undefined ? '' : `#${anchor}`})`
  })
  await writeFile(resolve(output, name), relocated)
}
await writeFile(resolve(artifactRoot, 'desktop-externals.json'), JSON.stringify([...externals].sort(), null, 2) + '\n')

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const packed = spawnSync(npm, ['pack', '--json', '--pack-destination', artifactRoot], {
  cwd: output,
  encoding: 'utf8',
  shell: process.platform === 'win32',
})
if (packed.status !== 0) throw new Error(packed.stderr || packed.stdout || 'npm pack failed')
process.stdout.write(packed.stdout)
