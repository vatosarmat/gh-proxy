import { config as envConfig } from 'dotenv'

import { GhProxy, GhProxyConfig } from './gh-proxy'

envConfig()

const proxyConfig: GhProxyConfig = {
  endpoints: [
    {
      path: '/users/:username',
      queryKeys: []
    },
    {
      path: '/search/users',
      queryKeys: ['q', 'per_page']
    },
    {
      path: '/users/:username/repos',
      queryKeys: ['per_page']
    }
  ]
}

const proxy = new GhProxy(proxyConfig)
proxy.run()
