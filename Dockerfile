FROM node:22-alpine AS build-stage

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

RUN npm run build

FROM node:22-alpine AS prod-stage

COPY --from=build-stage /app/dist /app/dist
COPY --from=build-stage /app/package.json /app/package.json

WORKDIR /app

RUN npm install --production

CMD ["node", "dist/main.js"]
