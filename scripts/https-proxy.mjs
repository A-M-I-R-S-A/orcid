#!/usr/bin/env node

import { createServer } from 'node:https'
import { request as httpRequest } from 'node:http'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'

const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 3443)
const TARGET_PORT = Number(process.env.TARGET_PORT ?? 3100)
const TARGET_HOST = process.env.TARGET_HOST ?? '127.0.0.1'

const certDir = path.join(tmpdir(), 'orchid-dev-cert')
const keyPath = path.join(certDir, 'key.pem')
const certPath = path.join(certDir, 'cert.pem')

if (!existsSync(keyPath) || !existsSync(certPath)) {
  mkdirSync(certDir, { recursive: true })
  console.log('generating a self-signed certificate for localhost…')

  execFileSync(
    'openssl',
    [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', keyPath,
      '-out', certPath,
      '-days', '30',
      '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { stdio: 'pipe' },
  )
}

const server = createServer(
  { key: readFileSync(keyPath), cert: readFileSync(certPath) },
  (clientReq, clientRes) => {
    const headers = {
      ...clientReq.headers,
      'x-forwarded-proto': 'https',
      'x-forwarded-host': clientReq.headers.host ?? `localhost:${HTTPS_PORT}`,
    }

    const upstream = httpRequest(
      { host: TARGET_HOST, port: TARGET_PORT, path: clientReq.url, method: clientReq.method, headers },
      (upstreamRes) => {
        clientRes.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
        upstreamRes.pipe(clientRes)
      },
    )

    upstream.on('error', (error) => {
      clientRes.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      clientRes.end(`upstream unreachable: ${error.message}`)
    })

    clientReq.pipe(upstream)
  },
)

server.listen(HTTPS_PORT, '127.0.0.1', () => {
  console.log(`https://localhost:${HTTPS_PORT}  →  http://${TARGET_HOST}:${TARGET_PORT}`)
  console.log('self-signed: browsers and curl need to be told to accept it.')
})
