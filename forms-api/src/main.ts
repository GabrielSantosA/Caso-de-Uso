/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import express, { Express } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { container } from "tsyringe";
import { createLogger, format, transports } from "winston";
import { Calculator } from "./core/app/services/Calculator";
import { FormService } from "./core/app/use-cases/FormService";
import { serverConfig, swaggerConfig } from "./core/domain/entities/config";
import { FieldValidator } from "./core/domain/ports/FieldValidator";
import { FormController } from "./core/infra/adapters/controllers/FormController";

const logger = createLogger({
  transports: [new transports.File({ filename: "app.log" })],
  format: format.combine(format.timestamp(), format.json()),
});

const swaggerSpec = swaggerJsdoc(swaggerConfig as any);

async function bootstrap(): Promise<void> {
  const app: Express = express();
  const prisma = new PrismaClient();
  const port = serverConfig.port;

  try {
    container.register("PrismaClient", { useValue: prisma });
    container.register("Calculator", { useClass: Calculator });
    container.register("FieldValidator", { useClass: FieldValidator });
    container.register("FormService", { useClass: FormService });
    container.register("FormController", { useClass: FormController });

    const formController = container.resolve(FormController);

    app.use(express.json());
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    app.post("/formularios", (req, res) => formController.create(req, res));
    app.put("/formularios/:id/schema_version", (req, res) =>
      formController.updateFormSchema(req, res)
    );
    app.delete("/formularios/:id", (req, res) =>
      formController.softDelete(req, res)
    );
    app.get("/formularios", (req, res) => formController.list(req, res));
    app.get("/formularios/:id", (req, res) => formController.getById(req, res));
    app.post("/formularios/:id/respostas", (req, res) =>
      formController.submitResponse(req, res)
    );
    app.get("/formularios/:id/respostas", (req, res) =>
      formController.listResponses(req, res)
    );
    app.delete("/formularios/:id/respostas/:id_resposta", (req, res) =>
      formController.softDeleteResponse(req, res)
    );

    const server = app.listen(port, () => {
      logger.info(`[server]: Servidor rodando em http://localhost:${port}`);
      logger.info(
        `[swagger]: Docs disponíveis em http://localhost:${port}/api-docs`
      );
    });

    process.on("SIGTERM", async () => {
      await prisma.$disconnect();
      server.close(() => process.exit(0));
    });
  } catch (error) {
    logger.error("Erro ao iniciar o servidor:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap().catch((error) => logger.error("Falha no bootstrap:", error));
