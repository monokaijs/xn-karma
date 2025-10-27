FROM node:22-alpine AS build-stage

WORKDIR /bills-check

COPY package.json .

RUN npm install

COPY . .

RUN npm run build

FROM node:22-alpine AS prod-stage

COPY --from=build-stage /bills-check/dist /bills-check/dist
COPY --from=build-stage /bills-check/package.json /bills-check/package.json

WORKDIR /bills-check

RUN npm install --production \
    && npm install -g pm2

CMD ["pm2-runtime", "dist/main.js", "-i", "max"]
