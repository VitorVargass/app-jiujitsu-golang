# syntax=docker/dockerfile:1
FROM node:24-alpine AS web
WORKDIR /build/mobile
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci
COPY mobile/ ./
ENV EXPO_NO_DOTENV=1 \
    EXPO_PUBLIC_API_URL=same-origin
RUN npm run build:web

FROM golang:1.27-alpine AS backend
WORKDIR /build/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D tatame
WORKDIR /app
COPY --from=backend /out/api /app/api
COPY --from=web /build/mobile/dist /app/web
ENV WEB_DIST_DIR=/app/web
USER tatame
EXPOSE 8080
ENTRYPOINT ["/app/api"]
