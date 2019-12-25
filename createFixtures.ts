import path from 'path'
import { promises } from 'fs'
import fetch from 'node-fetch'
import { URL } from 'url'
import LinkHeader from 'http-link-header'
import { config } from 'dotenv'
config()

if (!process.env.GITHUB_TOKEN) {
  console.error('Missing GITHUB_TOKEN env var')
  process.exit(1)
}

const { GITHUB_TOKEN } = process.env

const writeFile = promises.writeFile

const origin = 'https://api.github.com'

const requestsOfInterest = [
  '/users/microsoft',
  '/user/6154722/repos?per_page=10&page=3',
  '/users/no-such-user-on-github-i-am-sure'
] as const

const headersOfInterest = [
  'content-type',
  'access-control-allow-origin',
  'access-control-expose-headers',
  'link'
] as const

type TestRequestUrl = typeof requestsOfInterest[number]
type TestHeader = typeof headersOfInterest[number]

type Fixtures = {
  [TRU in TestRequestUrl]?: {
    status: number
    headers: { [TH in TestHeader]?: string }
    body: object
  }
}

function createFixtures(filePath: string) {
  const fixtures: Fixtures = {}

  return Promise.all(
    requestsOfInterest.map(reqUrl => {
      const url = new URL(`${origin}${reqUrl}`)
      url.searchParams.append('access_token', GITHUB_TOKEN)

      return fetch(url).then(resp => {
        return resp.json().then(body => {
          const headersData = headersOfInterest.reduce((obj, header) => {
            let headerValue = resp.headers.get(header)

            if (header === 'link' && headerValue) {
              const linkHeader = new LinkHeader(headerValue)

              for (const ref of linkHeader.refs) {
                const url = new URL(ref.uri)
                url.searchParams.set('access_token', 'replace_actual_token_with_this_silly_string')
                ref.uri = url.toString()
              }

              headerValue = linkHeader.toString()
            }

            return headerValue ? Object.assign(obj, { [header]: headerValue }) : obj
          }, {})

          fixtures[reqUrl] = {
            status: resp.status,
            headers: headersData,
            body
          }
        })
      })
    })
  ).then(_ => writeFile(filePath, JSON.stringify(fixtures, null, 1)))
}

const fixturesPath = path.join(__dirname, 'src', 'fixtures.json')

createFixtures(fixturesPath)
