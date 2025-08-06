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
  },
  apis: ["./adapters/repositories/controllers/*.ts"],
};
