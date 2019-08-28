import { URL } from 'url'
import qs from 'querystring'
import util from 'util'
import stream from 'stream'

import express, {
  Application,
  RequestHandler,
  Response as ExpressResponse,
  ErrorRequestHandler
} from 'express'
import compression from 'compression'
import fetch, { Response as FetchResponse } from 'node-fetch'
import LinkHeader from 'http-link-header'
import morgan from 'morgan'
import pick from 'object.pick'

const pipeline = util.promisify(stream.pipeline)

export interface GhProxyConfig {
  readonly endpoints: {
    readonly path: string
    readonly queryKeys: string[]
  }[]
}

export class GhProxy {
  private readonly app: Application
  private readonly baseUrl = 'https://api.github.com'
  private readonly access_token: string
  private readonly port: number

  constructor(private readonly config: GhProxyConfig) {
    const { GITHUB_TOKEN, PORT = '3000' } = process.env
    const port = parseInt(PORT)

    if (!GITHUB_TOKEN || port) {
      throw Error(`No GITHUB_TOKEN or wrong PORT value: ${PORT}`)
    }

    this.port = port
    this.access_token = GITHUB_TOKEN
    this.app = express()

    this.app.use(morgan('short'))
    this.app.use(compression())

    for (const item of config.endpoints) {
      this.app.get(item.path, (req, res, next) => {
        const {
          path,
          query,
          headers: { host }
        } = req

        const params = pick(query, item.queryKeys)

        if (host && item.queryKeys.every(key => params[key])) {
          fetch(this.makeUrl(path, params))
            .then(resp => GhProxy.pipeResponse(resp, res, host))
            .catch(next)
        } else {
          res.status(400).end()
        }
      })
    }

    this.app.all('/', this.notFoundHandler)
    this.app.use(this.errorHandler)
  }

  private static pipeResponse(from: FetchResponse, to: ExpressResponse, host: string) {
    const contentType = from.headers.get('Content-Type')
    const link = from.headers.get('Link')
    if (contentType) {
      to.type(contentType)
    }

    if (link) {
      const linkHeader = new LinkHeader(link)

      for (const ref of linkHeader.refs) {
        console.log(ref)
        const url = new URL(ref.uri)
        url.host = host
        url.searchParams.delete('access_token')
        ref.uri = url.toString()
        console.log(ref)
      }

      to.links(linkHeader.refs.reduce((obj, ref) => ({ ...obj, [ref.rel]: ref.uri }), {}))
    }

    return pipeline(from.body, to)
  }

  notFoundHandler: RequestHandler = (req, res) => {
    res.status(404).end()
  }

  errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    res.status(500).end()
  }

  private makeUrl(endpoint: string, params: { [key: string]: any }): string {
    const { access_token } = this
    return `${this.baseUrl}${endpoint}?${qs.stringify({ ...params, access_token })}`
  }

  run() {
    this.app.listen(this.port, () => {
      console.log(`Listening on port ${this.port}!`)
    })
  }
}
