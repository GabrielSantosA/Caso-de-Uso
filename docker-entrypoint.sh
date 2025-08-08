#!/bin/bash
set -e

echo "⏳ Esperando o banco de dados..."

sleep 5

echo "🚀 Rodando migrações do Prisma..."
npx prisma migrate deploy

echo "🌱 Executando o seed do banco de dados..."
npx prisma db seed

echo "✅ Migrações e seed concluídos. Iniciando a aplicação..."

exec "$@"