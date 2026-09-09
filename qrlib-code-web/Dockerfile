FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install production dependencies cleanly
# npm ci is faster and more reliable than npm install for CI/CD/Docker
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Security: Run as non-root user (provided by node image)
USER node

# Expose port
EXPOSE 3000

# Start command (direct node execution is better for signal handling)
CMD ["node", "src/server.js"]
