FROM node:18

WORKDIR /caso-de-uso

COPY package*.json tsconfig.json ./

RUN npm install

COPY . .

RUN npx prisma generate

COPY docker-entrypoint.sh .
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]

CMD ["npm", "run", "start:dev"]

EXPOSE 3010