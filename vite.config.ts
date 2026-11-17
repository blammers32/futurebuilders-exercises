import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { handleOpenRouter } from './server/openrouter.mjs'

function readBody(req: import('node:http').IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function openRouterPlugin(apiKey: string | undefined): Plugin {
  const attach = (server: ViteDevServer) => {
    server.middlewares.use('/api/openrouter', async (req, res) => {
      try {
        let payload: Record<string, unknown> = {}
        if (req.method === 'POST') {
          const raw = await readBody(req)
          payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
        }
        const result = await handleOpenRouter({ method: req.method, ...payload }, apiKey)
        res.statusCode = result.status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result.body))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy failed.' }))
      }
    })
  }
  return {
    name: 'openrouter-dev',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

function siteIndex(): Plugin {
  return {
    name: 'site-index',
    enforce: 'post',
    generateBundle(_, bundle) {
      const page = bundle['site.html']
      if (!page || page.type !== 'asset') return
      delete bundle['site.html']
      this.emitFile({ type: 'asset', fileName: 'index.html', source: page.source })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const site = mode === 'site'
  return {
    plugins: [react(), openRouterPlugin(env.OPENROUTER_API_KEY), ...(site ? [siteIndex()] : [])],
    server: { port: 5173 },
    ...(site && {
      base: './',
      build: { outDir: 'dist-site', rollupOptions: { input: 'site.html' } },
    }),
  }
})
