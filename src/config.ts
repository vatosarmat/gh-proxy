import { GhProxyConfig } from './gh-proxy'

const config: GhProxyConfig = {
  endpoints: [
    {
      path: '/users/:username'
    },
    {
      path: '/user/:id'
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

export default config
