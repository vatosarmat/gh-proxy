FROM node:12.14-slim

WORKDIR /home/node/app

COPY package.json yarn.lock ./

RUN yarn install --prod

COPY build ./build

CMD yarn start