# Stage 1: Build the static Expo Web production bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for native modules if any
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Pass build-time environment variable for the API base URL if provided
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL} \
    NODE_ENV=production

RUN npx --no-install expo export --platform web

# Stage 2: Serve the static bundle with high-performance Nginx
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
