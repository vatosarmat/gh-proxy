import express, { Application } from 'express'
import { config } from 'dotenv'

config()

const port = process.env.PORT || 3000
const app: Application = express()

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, function() {
  console.log(`Example app listening on port ${port}!`)
})
