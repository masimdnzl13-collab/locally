FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite bakes the API origin into the bundle at build time (src/api.ts). No default on purpose:
# an image built without --build-arg VITE_API_URL would silently call localhost, so the build
# fails instead (vite.config.ts, REQUIRE_VITE_API_URL). Local compose passes localhost explicitly.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV REQUIRE_VITE_API_URL=true
RUN npm run build
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# CSP frame-ancestors from ALLOWED_FRAME_ANCESTORS, resolved at container start (not baked in).
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/15-frame-ancestors.envsh /docker-entrypoint.d/15-frame-ancestors.envsh
RUN chmod +x /docker-entrypoint.d/15-frame-ancestors.envsh
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ || exit 1
