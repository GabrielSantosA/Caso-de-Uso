/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import express, {
  Express,
  Response as ExpressResponse,
  Request,
} from "express";
import "reflect-metadata";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { container } from "tsyringe";

import { Calculator } from "./core/app/services/Calculator";
import { FormService } from "./core/app/use-cases/FormService";
import { serverConfig, swaggerConfig } from "./core/domain/entities/config";
import { FieldValidator } from "./core/domain/ports/FieldValidator";
import { FormController } from "./core/infra/adapters/controllers/FormController";
import { FormRepositoryPrisma } from "./core/infra/adapters/repositories/FormRepositoryPrisma";

const logger = console;
const swaggerSpec = swaggerJsdoc(swaggerConfig as any);

async function bootstrap(): Promise<void> {
  const app: Express = express();
  const port = serverConfig.port;

  try {
    const prisma = new PrismaClient();

    await prisma.$connect();

    container.register<PrismaClient>("PrismaClient", { useValue: prisma });
    container.register("FormRepository", { useClass: FormRepositoryPrisma });
    container.register("FieldValidator", { useClass: FieldValidator });
    container.register("Calculator", { useClass: Calculator });
    container.register("FormService", { useClass: FormService });
    container.register("FormController", { useClass: FormController });

    const formController = container.resolve(FormController);

    app.use(express.json());
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    app.post("/formularios", (req: Request, res: ExpressResponse) =>
      formController.create(req, res)
    );
    app.put(
      "/formularios/:id/schema_version",
      (req: Request, res: ExpressResponse) =>
        formController.updateFormSchema(req, res)
    );
    app.delete("/formularios/:id", (req: Request, res: ExpressResponse) =>
      formController.softDelete(req, res)
    );
    app.get("/formularios", (req: Request, res: ExpressResponse) =>
      formController.list(req, res)
    );
    app.get("/formularios/:id", (req: Request, res: ExpressResponse) =>
      formController.getById(req, res)
    );
    app.post(
      "/formularios/:id/respostas",
      (req: Request, res: ExpressResponse) =>
        formController.submitResponse(req, res)
    );
    app.get(
      "/formularios/:id/respostas",
      (req: Request, res: ExpressResponse) =>
        formController.listResponses(req, res)
    );
    app.delete(
      "/formularios/:id/respostas/:id_resposta",
      (req: Request, res: ExpressResponse) =>
        formController.softDeleteResponse(req, res)
    );

    const server = app.listen(port, () => {
      logger.log(`[server]: Servidor rodando em http://localhost:${port}`);
      logger.log(
        `[swagger]: Docs disponíveis em http://localhost:${port}/api-docs`
      );
    });

    process.on("SIGTERM", async () => {
      await prisma.$disconnect();
      server.close(() => process.exit(0));
    });
  } catch (error) {
    logger.error("Erro ao iniciar o servidor:", error);
    process.exit(1);
  }
}

bootstrap().catch((error) => logger.error("Falha no bootstrap:", error));
