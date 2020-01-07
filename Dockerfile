FROM node:12.14

WORKDIR /home/node/app

COPY package.json yarn.lock ./

RUN yarn install --prod

COPY .env ./
COPY build ./build

CMD yarn start