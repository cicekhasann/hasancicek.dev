FROM nginx:1.29-alpine

# Nginx ayarını kopyala
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Statik portfolyo varlıklarını kopyala
COPY public/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
