FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3001

# Optional: health check for /health endpoint
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "src/server.js"]
