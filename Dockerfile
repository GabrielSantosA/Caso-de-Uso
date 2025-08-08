FROM node:18

# Define o diretório de trabalho principal na raiz do projeto
WORKDIR /caso-de-uso

# Copia os arquivos de configuração do projeto
COPY package*.json tsconfig.json ./

# Instala as dependências a partir do diretório raiz
RUN npm install

# Copia o restante dos arquivos do projeto
COPY . .

# Executa o comando do Prisma para gerar o cliente
RUN npx prisma generate

EXPOSE 3010

# Comando para iniciar o servidor
CMD ["npm", "run", "start:dev"]