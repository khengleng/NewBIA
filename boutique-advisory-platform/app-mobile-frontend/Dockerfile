# Use a lightweight node image for serving
FROM node:18-slim

# Install serve for static site hosting
RUN npm install -g serve

# Set working directory
WORKDIR /app

# Copy the pre-built web assets from our local build/web folder
# Note: This assumes you ran 'flutter build web' locally.
COPY build/web /app/build/web

# Expose the Railway-provided port
ENV PORT=8080
EXPOSE 8080

# Serve the static files
CMD ["serve", "-s", "build/web", "-p", "8080"]
