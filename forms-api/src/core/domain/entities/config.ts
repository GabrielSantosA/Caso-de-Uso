import path from "path";
import { Options } from "swagger-jsdoc";

export const serverConfig = {
  port: parseInt(process.env.PORT || "3010", 10),
};

export const swaggerConfig: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Engine de Formulários API",
      version: "1.0.0",
      description:
        "API para criação e gerenciamento de formulários dinâmicos e inteligentes.",
    },
    servers: [
      {
        url: `http://localhost:${serverConfig.port}`,
        description: "Servidor de Desenvolvimento",
      },
    ],
    components: {
      schemas: {
        Form: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "abc123",
            },
            nome: {
              type: "string",
              example: "Formulário de Exemplo",
            },
            descricao: {
              type: "string",
              example: "Descrição do formulário",
            },
            schema_version: {
              type: "integer",
              example: 1,
            },
            is_ativo: {
              type: "boolean",
              example: true,
            },
            data_criacao: {
              type: "string",
              format: "date-time",
              example: "2023-01-01T00:00:00Z",
            },
          },
        },
        FormListResponse: {
          type: "object",
          properties: {
            pagina_atual: {
              type: "integer",
              example: 1,
            },
            total_paginas: {
              type: "integer",
              example: 5,
            },
            total_itens: {
              type: "integer",
              example: 100,
            },
            formularios: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Form",
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "string",
              example: "Mensagem de erro",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
          },
        },
      },
      parameters: {
        pagina: {
          name: "pagina",
          in: "query",
          description: "Número da página",
          required: false,
          schema: {
            type: "integer",
            default: 1,
            minimum: 1,
          },
        },
        tamanho_pagina: {
          name: "tamanho_pagina",
          in: "query",
          description: "Quantidade de itens por página",
          required: false,
          schema: {
            type: "integer",
            default: 20,
            minimum: 1,
            maximum: 100,
          },
        },
        nome: {
          name: "nome",
          in: "query",
          description: "Filtra por nome do formulário",
          required: false,
          schema: {
            type: "string",
          },
        },
        schema_version: {
          name: "schema_version",
          in: "query",
          description: "Filtra por versão do schema",
          required: false,
          schema: {
            type: "integer",
          },
        },
        id: {
          name: "id",
          in: "path",
          description: "ID do formulário",
          required: true,
          schema: {
            type: "string",
          },
        },
        respostaId: {
          name: "respostaId",
          in: "path",
          description: "ID da resposta",
          required: true,
          schema: {
            type: "string",
          },
        },
      },
    },
  },
  apis: [
    path.join(
      process.cwd(),
      "forms-api",
      "src",
      "core",
      "infra",
      "adapters",
      "controllers",
      "*.ts"
    ),
  ],
};
