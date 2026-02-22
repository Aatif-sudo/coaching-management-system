FROM node:20-slim

WORKDIR /app

COPY package*.json /app/
RUN npm install --omit=dev

COPY . /app
RUN mkdir -p /app/storage/notes /app/storage/receipts

EXPOSE 8000

CMD ["npm", "start"]

