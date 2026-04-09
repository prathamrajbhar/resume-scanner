FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma:generate && pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
