FROM node:10

WORKDIR /app

COPY ./app/package*.json ./
RUN npm install --only=prod

COPY . .

ENV PATH="/app/:${PATH}"
CMD ["node", "app/index.js"]