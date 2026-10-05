FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@10.17.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN pnpm ocr:prepare

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3001 OCR_LANG_PATH=/app/ocr-data
RUN npm install --global pnpm@10.17.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/work/ocr-data ./ocr-data
USER node
EXPOSE 3001
CMD ["node", "dist-server/index.js"]
