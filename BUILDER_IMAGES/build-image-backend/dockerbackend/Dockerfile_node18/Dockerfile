FROM node:18-bullseye

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production

ENTRYPOINT sh -c "$START_CMD"