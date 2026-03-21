FROM node:20-alpine AS base
RUN npm install -g pnpm
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --ignore-scripts=false

COPY . .
RUN pnpm build

FROM node:20-alpine AS production
RUN npm install -g pnpm
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts=false

COPY --from=base /app/dist ./dist

RUN mkdir -p /app/uploads

EXPOSE 4000
CMD ["node", "dist/index.js"]
