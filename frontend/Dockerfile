FROM node:22-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY branding.json /app/branding.json
COPY frontend/ .
RUN npm run build

FROM nginx:stable-alpine
ENV PUBLIC_SCHEME=http
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
