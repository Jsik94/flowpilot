FROM node:20-alpine AS build

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN pnpm install --frozen-lockfile

COPY backend backend
COPY frontend frontend

RUN pnpm --filter backend build

FROM node:20-alpine AS runtime

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json backend/package.json

RUN pnpm install --filter backend... --prod --frozen-lockfile

COPY --from=build /app/backend/dist backend/dist

EXPOSE 3001

CMD ["node", "backend/dist/main.js"]
