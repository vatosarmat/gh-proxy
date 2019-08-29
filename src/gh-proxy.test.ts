import assert from 'assert'
import { URL } from 'url'

import request from 'supertest'
import { config as envConfig } from 'dotenv'

import { GhProxy, GhProxyConfig } from './gh-proxy'

envConfig()

const proxyConfig: GhProxyConfig = {
  endpoints: [
    {
      path: '/users/:username/repos',
      queryKeys: {
        required: 'per_page',
        optional: 'page'
      }
    }
  ]
}

const proxy = new GhProxy(proxyConfig)

describe('GitHub requests proxy', () => {
  it('Returns result with expected headers and content', () => {
    const req = request(proxy.app).get('/users/microsoft/repos?per_page=42&page=3')

    const url = new URL(req.url)
    const linkRegexp = `<.*${url.host}.*>;\\s+rel="next"`

    return req
      .expect('Content-Type', /json/)
      .expect('Link', new RegExp(linkRegexp))
      .expect('Content-Encoding', /gzip/)
      .expect('Access-Control-Allow-Origin', /.*/)
      .expect('Access-Control-Expose-Headers', /Link/)
      .expect(200)
      .then(response => {
        assert.strictEqual(response.body.length, 42, 'Wrong body')
      })
  })

  it('Wrong endpoints correctly handled', () => {
    return request(proxy.app)
      .get('/wrong/')
      .expect(404)
  })

  it('Aborts?', () => {
    const req = request(proxy.app)
    const prom = req.get('/users/microsoft/repos')
    setTimeout(() => prom.abort(), 2)
  })
})
