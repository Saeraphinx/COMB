FROM node:22-alpine AS base
FROM base AS builder

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --immutable --immutable-cache --check-cache
COPY . .
RUN yarn build

FROM base
WORKDIR /app

RUN \
  addgroup --system --gid 1001 node && \
  adduser --system --uid 1001 node

COPY --chown=1001:1001 package.json ./
COPY --chown=1001:1001 --from=builder /app/node_modules ./node_modules
COPY --chown=1001:1001 --from=builder /app/build ./build

USER nodejs
ENV NODE_ENV=production

CMD ["yarn", "start"]