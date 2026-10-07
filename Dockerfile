# CDAD — College Digital Academic Dashboard
# Single-container Node/Express server: serves the REST API (/api/*)
# and the static frontend from the same process/port, backed by SQLite.

FROM node:22-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/
COPY index.html student.html faculty.html group-details.html ./
COPY css/ ./css/
COPY js/ ./js/

EXPOSE 3000

CMD ["node", "server/index.js"]
