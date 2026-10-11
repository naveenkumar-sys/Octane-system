# ========================================================
# Stage 1: Build React Production Bundle
# ========================================================
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./

# Build production bundle (outputs to /app/dist)
RUN npm run build

# ========================================================
# Stage 2: Serve via High-Performance Nginx
# ========================================================
FROM nginx:alpine

# Remove default Nginx welcome configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom reverse-proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled frontend static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
