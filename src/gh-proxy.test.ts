import assert from 'assert'
import request from 'supertest'
import { config as envConfig } from 'dotenv'

import { GhProxy, GhProxyConfig } from './gh-proxy'

envConfig()

const proxyConfig: GhProxyConfig = {
  endpoints: [
    {
      path: '/users/:username/repos',
      queryKeys: ['per_page']
    }
  ]
}

const proxy = new GhProxy(proxyConfig)

describe('GitHub requests proxy', () => {
  it('Returns result with expected headers and content', () => {
    return request(proxy.app)
      .get('/users/microsoft/repos?per_page=42')
      .expect('Content-Type', /json/)
      .expect('Link', /rel="next"/)
      .expect(200)
      .expect('Content-Encoding', /gzip/)
      .then(response => {
        assert.strictEqual(response.body.length, 42, 'Wrong body')
      })
  })
})
