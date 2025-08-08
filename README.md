# Plataforma de Formulários Inteligentes

## 📋 Pré-requisitos

Antes de começar, verifique se você possui:

- [Node.js](https://nodejs.org/) 18+ (LTS recomendado)
- [PostgreSQL](https://www.postgresql.org/) 14+
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/) v2+
- [Git](https://git-scm.com/) (para clonar o repositório)

## Instalação

### Método 1: Usando Docker (Recomendado)

```bash
# 1. Clone o repositório
git clone https://github.com/GabrielSantosA/Caso-de-Uso.git
cd caso-de-uso

cp .env.example .env

# 3. Inicie os containers
docker-compose up -d --build

# 4. Acessando a aplicação
A aplicação estará disponível em http://localhost:3010.

A documentação interativa da API, gerada com Swagger UI, pode ser acessada em http://localhost:3010/api-docs.
```
