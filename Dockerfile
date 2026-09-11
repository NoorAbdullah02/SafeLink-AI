FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@10.17.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3001
RUN npm install --global pnpm@10.17.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/migrations ./migrations
USER node
EXPOSE 3001
CMD ["node", "dist-server/index.js"]
