import { config as envConfig } from 'dotenv'

import { GhProxy, GhProxyConfig } from './gh-proxy'

envConfig()

const proxyConfig: GhProxyConfig = {
  endpoints: [
    {
      path: '/users/:username'
    },
    {
      path: '/search/users',
      queryKeys: { required: ['q', 'per_page'] }
    },
    {
      path: '/users/:username/repos',
      queryKeys: { required: 'per_page', optional: 'page' }
    },
    {
      path: '/user/:id/repos',
      queryKeys: { required: 'per_page', optional: 'page' }
    }
  ]
}

const proxy = new GhProxy(proxyConfig)
proxy.run()
