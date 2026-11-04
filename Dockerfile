# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    SQL_QUEST_DB=/data/sql-quest.db
COPY --from=build /app/.output ./.output
# Mount a volume at /data to keep progress across restarts
# (docker run -v sql-quest-data:/data, or a Railway volume).
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
