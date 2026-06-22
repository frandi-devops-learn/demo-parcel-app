FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL

COPY index.html ./
COPY src ./src

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 5173

CMD ["npm", "run", "preview", "--", "--port", "5173"]
