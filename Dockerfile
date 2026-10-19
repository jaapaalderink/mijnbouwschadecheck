# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --fetch-retries=1 --fetch-timeout=30000
COPY --chown=node:node tsconfig.json vite.config.ts index.html ./
COPY --chown=node:node src ./src
COPY --chown=node:node server ./server
COPY --chown=node:node tests ./tests
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node package.json package-lock.json ./
# tsx is required by the runtime and database-management commands.
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --omit=dev --fetch-retries=1 --fetch-timeout=30000
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node src/domain.ts ./src/domain.ts
COPY --chown=node:node src/seo.ts ./src/seo.ts
COPY --chown=node:node app.cjs ./app.cjs
COPY --chown=node:node database ./database
USER node
EXPOSE 3001
CMD ["npm", "start"]
