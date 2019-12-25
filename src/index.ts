import { config as envConfig } from 'dotenv'

import { GhProxy } from './gh-proxy'
import config from './config'

envConfig()

const proxy = new GhProxy(config)
proxy.run()
