import qs from 'querystring'
import express, { Application, RequestHandler } from 'express'
import { config } from 'dotenv'
import fetch from 'node-fetch'

config()
const baseUrl = 'https://api.github.com'
const accessToken = process.env.GITHUB_TOKEN
const port = process.env.PORT || 3000
const app: Application = express()

if (!accessToken) {
  throw Error('No GITHUB_TOKEN in environment')
}

function withCatch(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

function makeUrl(endpoint: string, params: { [key: string]: any }): string {
  const url = `${baseUrl}${endpoint}?${qs.stringify(params)}`
  console.log(url)
  return url
}

app.get(
  '/search/users',
  withCatch(async (req, res) => {
    const {
      path,
      query: { q, per_page }
    } = req

    console.log(q, per_page)
    console.log(path)

    if (q && per_page) {
      const data = await fetch(makeUrl(path, { q, per_page, accessToken })).then(resp =>
        resp.json()
      )
      res.json(data)
    } else {
      res.status(400).end()
    }
  })
)

app.get(
  '/users/:username',
  withCatch(async (req, res) => {
    const { path } = req

    const data = await fetch(makeUrl(path, { accessToken })).then(resp => resp.json())
    res.json(data)
  })
)

//filter forks and repo fields here
//handle links header
//redirect data with streams?
app.get(
  '/users/:username/repos',
  withCatch(async (req, res) => {
    const {
      path,
      query: { page, per_page }
    } = req

    if (per_page) {
      const data = await fetch(makeUrl(path, { page, per_page, accessToken })).then(resp =>
        resp.json()
      )
      res.json(data)
    } else {
      res.status(400).end()
    }
  })
)

app.listen(port, function() {
  console.log(`Example app listening on port ${port}!`)
})
