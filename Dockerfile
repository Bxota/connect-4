FROM node:25-alpine AS web-build
WORKDIR /web
COPY webapp/package.json webapp/package-lock.json ./
RUN npm ci
COPY webapp/ .
RUN npm run build

FROM golang:1.24-alpine AS go-build
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
RUN CGO_ENABLED=0 go build -o /out/connect-4

FROM alpine:3.20
RUN adduser -D -H -u 10001 app
WORKDIR /app
COPY --from=go-build /out/connect-4 /app/connect-4
COPY --from=web-build /web/dist /app/web
ENV ADDR=:8080
ENV WEB_DIR=/app/web
EXPOSE 8080
USER 10001
ENTRYPOINT ["/app/connect-4"]
