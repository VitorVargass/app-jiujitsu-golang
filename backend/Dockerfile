FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /api ./cmd/api
RUN CGO_ENABLED=0 go build -o /seed ./cmd/seed
FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D tatame
USER tatame
COPY --from=build /api /api
COPY --from=build /seed /seed
EXPOSE 8080
ENTRYPOINT ["/api"]
