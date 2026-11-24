# Optional: container deployment to Azure App Service or Container Apps.
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
CMD ["node","backend/src/server.js"]
