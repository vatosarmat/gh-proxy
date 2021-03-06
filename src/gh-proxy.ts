import { URL } from 'url'
import qs from 'querystring'
import util from 'util'
import stream from 'stream'

import express, {
  Application,
  RequestHandler,
  Request as ExpressRequest,
  Response as ExpressResponse,
  ErrorRequestHandler
} from 'express'
import compression from 'compression'
import fetch, { Response as FetchResponse } from 'node-fetch'
import LinkHeader from 'http-link-header'
import morgan from 'morgan'
import pick from 'object.pick'
import cors from 'cors'

const pipeline = util.promisify(stream.pipeline)

export interface GhProxyConfig {
  readonly endpoints: {
    readonly path: string
    readonly queryKeys?: {
      readonly required?: string | string[]
      readonly optional?: string | string[]
    }
  }[]
}

export class GhProxy {
  private readonly _app: Application

  private readonly baseUrl = 'https://api.github.com'
  private readonly access_token: string
  private readonly port: number
  private readonly protocol: 'http' | 'https'
  private readonly proxy?: string

  constructor(private readonly config: GhProxyConfig) {
    const { GITHUB_TOKEN, PORT = '3000', HTTPS, PROXY } = process.env
    const port = parseInt(PORT)

    if (!GITHUB_TOKEN || !port) {
      throw Error(`No GITHUB_TOKEN or wrong PORT value: ${PORT}`)
    }

    this.protocol = HTTPS ? 'https' : 'http'
    this.port = port
    this.access_token = GITHUB_TOKEN
    this.proxy = PROXY

    console.log(`protocol: ${this.protocol}, proxy: ${this.proxy ?? 'no'}`)

    this._app = express()
    this._app.use(morgan('short'))
    this._app.use(compression())
    this._app.use(
      cors({
        exposedHeaders: ['Link']
      })
    )

    for (const item of config.endpoints) {
      this._app.get(item.path, (req, res, next) => {
        const {
          path,
          query,
          headers: { host: reqHost }
        } = req

        let requiredKeys: string[] = []
        let optionalKeys: string[] = []

        if (item.queryKeys) {
          const { required, optional } = item.queryKeys
          requiredKeys = required ? [required].flat() : []
          optionalKeys = optional ? [optional].flat() : []
        }

        const queryParams = pick(query, [...requiredKeys, ...optionalKeys])

        if (reqHost && requiredKeys.every(key => queryParams[key])) {
          fetch(this.makeUrl(path, queryParams))
            .then(resp => this.pipeResponse(resp, res, this.proxy ?? reqHost))
            .catch(next)
        } else {
          res.status(400).end()
        }
      })
    }

    this._app.use(this.notFoundHandler)
    this._app.use(this.errorHandler)
  }

  private pipeResponse(from: FetchResponse, to: ExpressResponse, linkHost: string) {
    const contentType = from.headers.get('Content-Type')
    const link = from.headers.get('link')
    to.status(from.status)
    if (contentType) {
      to.type(contentType)
    }

    if (link) {
      const linkHeader = new LinkHeader(link)

      for (const ref of linkHeader.refs) {
        const url = new URL(ref.uri)
        url.host = linkHost
        url.protocol = this.protocol
        url.searchParams.delete('access_token')
        ref.uri = url.toString()
      }

      to.setHeader('link', linkHeader.toString())
    }

    return pipeline(from.body, to)
  }

  notFoundHandler: RequestHandler = (req, res) => {
    res.status(404).end()
  }

  errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.log(err.toString())
    res.status(500).end()
  }

  private makeUrl(endpoint: string, params: { [key: string]: any }): string {
    const { access_token } = this
    return `${this.baseUrl}${endpoint}?${qs.stringify({ ...params, access_token })}`
  }

  run() {
    this._app.listen(this.port, () => {
      console.log(`Listening on port ${this.port}!`)
    })
  }

  get app() {
    return this._app
  }
}
