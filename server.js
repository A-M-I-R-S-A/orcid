const { createServer } = require('node:http')

process.chdir(__dirname)

if (process.env.NODE_ENV !== 'production') {
  console.error(
    `[orchid] refusing to start: NODE_ENV is "${process.env.NODE_ENV || 'unset'}", expected "production".\n` +
      `[orchid] In cPanel > Setup Node.js App, set Application mode to Production and restart.`,
  )
  process.exit(1)
}

const next = require('next')

const port = parseInt(process.env.PORT || '3000', 10)
const app = next({ dev: false, dir: __dirname })
const handle = app.getRequestHandler()

process.on('unhandledRejection', (reason) => {
  console.error('[orchid] unhandled rejection:', reason)
})

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      handle(req, res).catch((err) => {
        console.error('[orchid] request failed:', err)
        res.statusCode = 500
        res.end('Internal Server Error')
      })
    }).listen(port, () => {
      console.log(`[orchid] ready (pid ${process.pid}, cwd ${process.cwd()})`)
    })
  })
  .catch((err) => {
    console.error('[orchid] failed to start:', err)
    process.exit(1)
  })
