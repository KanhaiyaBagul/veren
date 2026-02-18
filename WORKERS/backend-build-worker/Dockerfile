FROM node:20-bullseye

WORKDIR /app

COPY package*.json ./
COPY package-lock.json ./

COPY WORKERS/backend-build-worker ./WORKERS/backend-build-worker
COPY packages ./packages

RUN npm install --workspaces --legacy-peer-deps

RUN npm run build --workspace=WORKERS/backend-build-worker

EXPOSE 3000

CMD ["npm", "start", "--workspace=WORKERS/backend-build-worker"]
