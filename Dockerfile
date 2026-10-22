# syntax=docker/dockerfile:1

# O contexto de build deve ser a raiz do repositorio: backend + mobile.
FROM node:24-alpine AS web
WORKDIR /build/mobile

COPY mobile/package.json mobile/package-lock.json ./
# O Expo e o TypeScript precisam das dependencias de desenvolvimento no build.
RUN npm ci --include=dev --no-audit --no-fund
COPY mobile/ ./
ENV CI=1 \
    EXPO_NO_DOTENV=1 \
    EXPO_PUBLIC_API_URL=same-origin
RUN npm run build:web \
    && npm run typecheck \
    && test -s dist/index.html

FROM golang:1.27-alpine AS backend
WORKDIR /build/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download && go mod verify
COPY backend/ ./
# As migracoes SQL sao incorporadas no executavel pelo go:embed.
RUN CGO_ENABLED=0 GOOS=linux go build \
    -mod=readonly -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.22 AS runtime
RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D tatame
WORKDIR /app

COPY --from=backend /out/api /app/api
COPY --from=web /build/mobile/dist /app/web

# O Render substitui PORT em execucao; a API escuta em todas as interfaces.
ENV PORT=8080 \
    WEB_DIST_DIR=/app/web
USER tatame
EXPOSE 8080
STOPSIGNAL SIGTERM
ENTRYPOINT ["/app/api"]
