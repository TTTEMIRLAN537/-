# Продакшен-образ: один контейнер отдаёт и сайт, и API с одного адреса.
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
# Пустой адрес = API на том же домене, что и сайт
ENV REACT_APP_API_URL=""
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=web /web/build ./static
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
