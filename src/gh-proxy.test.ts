import assert from 'assert'
import { URL } from 'url'
import request from 'supertest'
import nock from 'nock'

import { config as envConfig } from 'dotenv'
import { GhProxy } from './gh-proxy'
import proxyConfig from './config'
import fixtures from './fixtures.json'

envConfig()

if (!process.env.GITHUB_TOKEN) {
  console.error('Missing GITHUB_TOKEN env var')
  process.exit(1)
}

const proxy = new GhProxy(proxyConfig)
const origin = 'https://api.github.com'

describe('GitHub requests proxy', () => {
  it('Works on user data request', () => {
    const reqUrl = '/users/microsoft'
    const { status, body, headers } = fixtures[reqUrl]

    nock(origin)
      .get(reqUrl)
      .query({
        access_token: /\w+/
      })
      .once()
      .reply(status, body, headers)

    const req = request(proxy.app).get(reqUrl)

    return req
      .expect('Content-Type', /application\/json/)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Access-Control-Expose-Headers', /Link/)
      .expect(200)
      .then(resp => {
        assert.strictEqual(resp.body.login, 'microsoft')
      })
  })

  it('Works on user repos request', () => {
    const reqUrl = '/user/6154722/repos?per_page=10&page=3'
    const { status, body, headers } = fixtures[reqUrl]

    const url = new URL(reqUrl, origin)

    const q = {
      ...Array.from(url.searchParams.entries()).reduce(
        (obj, [key, value]) => ({ ...obj, [key]: value }),
        {}
      ),
      access_token: /\w+/
    }

    nock(url.origin)
      .get(url.pathname)
      .query(q)
      .once()
      .reply(status, body, headers)

    const req = request(proxy.app).get(reqUrl)
    const testOrigin = new URL(req.url).origin

    const expectedLinkHeaderValue =
      `<${testOrigin}/user/6154722/repos?per_page=10&page=2>; rel=prev, ` +
      `<${testOrigin}/user/6154722/repos?per_page=10&page=4>; rel=next, ` +
      `<${testOrigin}/user/6154722/repos?per_page=10&page=292>; rel=last, ` +
      `<${testOrigin}/user/6154722/repos?per_page=10&page=1>; rel=first`

    return req
      .expect('Content-Type', /application\/json/)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Access-Control-Expose-Headers', /Link/)
      .expect('Link', expectedLinkHeaderValue)
      .expect(200)
      .then(resp => {
        const body = resp.body
        assert(Array.isArray(resp.body))
        assert(body.length === 10)
        assert(
          body.every(
            (repo: any) =>
              repo.id && repo.name && repo.url && repo.owner && repo.owner.id == 6154722
          )
        )
      })
  })

  it('Responds with 404 if no such resource', () => {
    const reqUrl = '/users/no-such-user-on-github-i-am-sure'
    const { status, body, headers } = fixtures[reqUrl]

    nock(origin)
      .get(reqUrl)
      .query({
        access_token: /\w+/
      })
      .once()
      .reply(status, body, headers)

    const req = request(proxy.app).get(reqUrl)

    return req
      .expect('Content-Type', /application\/json/)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Access-Control-Expose-Headers', /Link/)
      .expect(404)
      .then(resp => {
        assert.strictEqual(resp.body.message, 'Not Found')
      })
  })

  it('Responds with 400 if missing query params', () => {
    const reqUrl = '/search/users?per_page=10'

    const req = request(proxy.app).get(reqUrl)

    return req.expect(400)
  })

  it('Responds with 404 if wrong endpoint', () => {
    const reqUrl = '/games'

    const req = request(proxy.app).get(reqUrl)

    return req.expect(404)
  })
})
