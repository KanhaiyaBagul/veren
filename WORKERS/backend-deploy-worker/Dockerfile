FROM node:20-bullseye

WORKDIR /app

COPY package*.json ./
COPY package-lock.json ./

COPY WORKERS/backend-deploy-worker ./WORKERS/backend-deploy-worker
COPY packages ./packages

RUN npm install --workspaces --legacy-peer-deps

RUN npm run build --workspace=backend-deploy-worker

EXPOSE 3000

CMD ["npm", "start", "--workspace=backend-deploy-worker"]