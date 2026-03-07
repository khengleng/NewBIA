# Dockerfile for Mobile-Bot-Service (Telegram Bot + Push Notification Hub)

FROM node:18-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest (excluding what's in .dockerignore)
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Set environment variables (Railway will override these)
ENV NODE_ENV=production
ENV PORT=3000

# Start the service
CMD ["npm", "start"]
