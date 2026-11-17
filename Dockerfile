# Sats-for-Data: production image. Build: docker build -t sats-for-data .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
