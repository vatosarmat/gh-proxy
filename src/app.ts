import { URL } from 'url'
import qs from 'querystring'
import util from 'util'
import stream from 'stream'

import express, { Application, RequestHandler, Response as ExpressResponse } from 'express'
import compression from 'compression'
import { config } from 'dotenv'
import fetch, { Response as FetchResponse } from 'node-fetch'
import LinkHeader from 'http-link-header'

const pipeline = util.promisify(stream.pipeline)

config()
const baseUrl = 'https://api.github.com'
const access_token = process.env.GITHUB_TOKEN
const port = process.env.PORT || 3000
const app: Application = express()

if (!access_token) {
  throw Error('No GITHUB_TOKEN in environment')
}

function withCatch(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

function makeUrl(endpoint: string, params: { [key: string]: any }): string {
  const url = `${baseUrl}${endpoint}?${qs.stringify(params)}`
  //console.log(url)
  return url
}

async function pipeResponse(from: FetchResponse, to: ExpressResponse, host: string) {
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

app.use(compression())

app.get(
  '/search/users',
  withCatch(async (req, res) => {
    const {
      path,
      query: { q, per_page },
      headers: { host }
    } = req

    //console.log(req)

    if (q && per_page && host) {
      fetch(makeUrl(path, { q, per_page, access_token })).then(resp =>
        pipeResponse(resp, res, host)
      )
    } else {
      res.status(400).end()
    }
  })
)

app.get(
  '/users/:username',
  withCatch(async (req, res) => {
    const {
      path,
      headers: { host }
    } = req

    if (host) {
      fetch(makeUrl(path, { access_token })).then(resp => pipeResponse(resp, res, host))
    }
  })
)

//filter forks and repo fields here
//handle links header
app.get(
  '/users/:username/repos',
  withCatch(async (req, res) => {
    const {
      path,
      query: { page, per_page },
      headers: { host }
    } = req

    if (per_page && host) {
      fetch(makeUrl(path, { page, per_page, access_token })).then(resp =>
        pipeResponse(resp, res, host)
      )
    } else {
      res.status(400).end()
    }
  })
)

app.listen(port, function() {
  console.log(`Example app listening on port ${port}!`)
})
