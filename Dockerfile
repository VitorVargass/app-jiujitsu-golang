# syntax=docker/dockerfile:1

# TatameMix: Expo SDK 58 + API Go para Azure Container Apps e Render.
# Contexto: raiz do repositorio. Destino Azure: linux/amd64.
FROM node:24-alpine AS web
WORKDIR /build/mobile

COPY mobile/package.json mobile/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev --no-audit --no-fund
COPY mobile/ ./
ENV CI=1 \
    EXPO_NO_DOTENV=1 \
    EXPO_PUBLIC_API_URL=same-origin
RUN npm run typecheck \
    && npm run lint \
    && node --experimental-strip-types --test tests/*.test.mjs \
    && npm run build:web \
    && test -s dist/index.html \
    && test -d dist/_expo/static/js/web

FROM golang:1.27-alpine AS backend
WORKDIR /build/backend
COPY backend/go.mod backend/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download && go mod verify
COPY backend/ ./
# As migracoes SQL sao incorporadas no executavel pelo go:embed.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build \
    -mod=readonly -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.22 AS runtime
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 tatame \
    && adduser -S -D -H -u 10001 -G tatame tatame
WORKDIR /app
COPY --from=backend /out/api /app/api
COPY --from=web /build/mobile/dist /app/web

# Segredos sao configurados em execucao na hospedagem, nunca como build args.
# Azure: ingress externo HTTP, target port 8080. Render pode substituir PORT.
# Nao configure HTTP_ADDR: ele tem precedencia sobre PORT.
# Configure probes na plataforma: /healthz depende do banco.
ENV PORT=8080 \
    WEB_DIST_DIR=/app/web
USER 10001:10001
EXPOSE 8080
STOPSIGNAL SIGTERM
ENTRYPOINT ["/app/api"]
