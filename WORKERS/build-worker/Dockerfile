FROM node:20-bullseye

WORKDIR /src

# Install deps (include devDependencies since we need nodemon + ts-node inside container)
COPY package*.json ./
COPY tsconfig.json ./

# Copy everything else
COPY . .

# Default port (will be overridden by docker-compose)
EXPOSE 3000

# Run dev server with nodemon + ts-node/esm
CMD ["sh", "-c", "npm install && npm run build:worker"]
