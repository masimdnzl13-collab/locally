# Legacy SQLite application image. Production deployment uses apps/api/Dockerfile
# and docker-compose.yml; this image is retained only for local compatibility.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json eslint.config.js ./
COPY src ./src
RUN npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=development
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
EXPOSE 4000
CMD ["node", "dist/server.js"]
