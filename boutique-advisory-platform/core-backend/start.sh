#!/bin/sh
set -e

echo "🚀 BIA Backend Startup Script"
echo "================================"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: ${PORT:-3000}"
echo "DATABASE_URL exists: $(if [ -n "$DATABASE_URL" ]; then echo 'YES'; else echo 'NO - CRITICAL!'; fi)"
echo "JWT_SECRET exists: $(if [ -n "$JWT_SECRET" ]; then echo 'YES'; else echo 'NO - CRITICAL!'; fi)"
echo "INITIAL_ADMIN_PASSWORD exists: $(if [ -n "$INITIAL_ADMIN_PASSWORD" ]; then echo 'YES'; else echo 'NO'; fi)"
echo "================================"

# Note: All critical configuration validation (JWT_SECRET, DATABASE_URL, etc.) 
# is now handled inside the Node.js application. 
# This ensures the server can start and pass Railway health checks even if config is missing.


# Note: Detailed database discovery and connectivity checks are now handled 
# inside the Node.js application to ensure the health check can respond immediately.
echo "📡 Handing over database connection management to Node.js..."



# Start the application
echo "🚀 Starting Node.js server..."
exec node dist/index.js
