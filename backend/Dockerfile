FROM node:22-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
RUN mkdir -p /usr/src/node-app && chown -R node:node /usr/src/node-app

WORKDIR /usr/src/node-app

# Copy package files
COPY --chown=node:node package*.json ./

# Switch to node user
USER node

# Install dependencies before copying source for better Docker layer caching
RUN npm ci

# Copy source code with proper ownership
COPY --chown=node:node . .

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command (can be overridden by docker-compose)
CMD ["npm", "run", "start"]
