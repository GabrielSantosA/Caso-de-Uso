/* eslint-disable @typescript-eslint/no-explicit-any */
import express, { Request, Response } from "express";
import { mockDeep } from "jest-mock-extended";
import supertest from "supertest";
import { FormService } from "../../core/app/use-cases/FormService";
import { FormController } from "../../core/infra/adapters/controllers/FormController";

const mockFormService = mockDeep<FormService>();

const formController = new FormController(mockFormService as any);

const app = express();
app.use(express.json());
app.post("/formularios", (req: Request, res: Response) =>
  formController.create(req, res)
);
app.get("/formularios", (req: Request, res: Response) =>
  formController.list(req, res)
);
app.get("/formularios/:id", (req: Request, res: Response) =>
  formController.getById(req, res)
);
app.put("/formularios/:id/schema_version", (req: Request, res: Response) =>
  formController.updateFormSchema(req, res)
);
app.delete("/formularios/:id", (req: Request, res: Response) =>
  formController.softDelete(req, res)
);
app.post("/formularios/:id/respostas", (req: Request, res: Response) =>
  formController.submitResponse(req, res)
);
app.get("/formularios/:id/respostas", (req: Request, res: Response) =>
  formController.listResponses(req, res)
);
app.delete(
  "/formularios/:id/respostas/:respostaId",
  (req: Request, res: Response) => formController.softDeleteResponse(req, res)
);

describe("FormController", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("POST /formularios", () => {
    it("deve criar um formulário com sucesso e retornar 201", async () => {
      const formPayload = {
        nome: "Test Form",
        campos: [
          { id: "name", tipo: "text", label: "Name", obrigatorio: true },
        ],
      };
      const mockFormResult = {
        id: "form_001",
        ...formPayload,
        schema_version: 1,
        data_criacao: new Date(),
      };

      mockFormService.criarFormulario.mockResolvedValue(mockFormResult as any);

      const response = await supertest(app)
        .post("/formularios")
        .send(formPayload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: mockFormResult.id,
          nome: mockFormResult.nome,
          schema_version: mockFormResult.schema_version,
          criado_em: mockFormResult.data_criacao.toISOString(),
        },
      });
      expect(mockFormService.criarFormulario).toHaveBeenCalledWith(formPayload);
    });

    it("deve retornar 400 para dados de formulário inválidos", async () => {
      const invalidPayload = {
        nome: "",
        campos: [],
      };

      const response = await supertest(app)
        .post("/formularios")
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it("deve retornar 400 se o serviço lançar um erro de validação", async () => {
      const formPayload = {
        nome: "Form with circular dependency",
        campos: [
          { id: "a", tipo: "number", dependencias: ["b"] },
          { id: "b", tipo: "number", dependencias: ["a"] },
        ],
      };
      mockFormService.criarFormulario.mockRejectedValue(
        new Error("Dependência circular detectada")
      );

      const response = await supertest(app)
        .post("/formularios")
        .send(formPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Dependência circular detectada");
    });
  });

  describe("GET /formularios", () => {
    it("deve listar formulários com sucesso e retornar 200", async () => {
      const mockForms = [
        {
          id: "f1",
          nome: "Form A",
          schema_version: 1,
          data_criacao: new Date(),
          is_ativo: true,
          campos: [],
        },
        {
          id: "f2",
          nome: "Form B",
          schema_version: 2,
          data_criacao: new Date(),
          is_ativo: true,
          campos: [],
        },
      ];
      mockFormService.listarFormularios.mockResolvedValue(mockForms as any);

      const response = await supertest(app).get(
        "/formularios?pagina=1&tamanho_pagina=10"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.resultados).toHaveLength(2);
      expect(mockFormService.listarFormularios).toHaveBeenCalledWith({
        pagina: 1,
        tamanho_pagina: 10,
        nome: undefined,
        schema_version: undefined,
        incluirInativos: undefined,
      });
    });
  });

  describe("GET /formularios/:id", () => {
    it("deve retornar um formulário por ID com sucesso", async () => {
      const formId = "form_001";
      const mockForm = {
        id: formId,
        nome: "Test Form",
        data_criacao: new Date(),
        campos: [],
      };
      mockFormService.obterFormularioPorId.mockResolvedValue(mockForm as any);

      const response = await supertest(app).get(`/formularios/${formId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(formId);
      expect(mockFormService.obterFormularioPorId).toHaveBeenCalledWith(formId);
    });

    it("deve retornar 404 se o formulário não for encontrado", async () => {
      const formId = "form_nao_existe";
      mockFormService.obterFormularioPorId.mockResolvedValue(null);

      const response = await supertest(app).get(`/formularios/${formId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Formulário não encontrado");
    });
  });

  describe("PUT /formularios/:id/schema_version", () => {
    it("deve atualizar o schema e retornar 200", async () => {
      const formId = "form_001";
      const updatePayload = {
        nome: "Updated Form",
        campos: [
          { id: "name", tipo: "text", label: "Name", obrigatorio: true },
        ],
      };
      const mockUpdatedForm = { id: formId, schema_version: 2 };

      mockFormService.atualizarSchemaFormulario.mockResolvedValue(
        mockUpdatedForm as any
      );

      const response = await supertest(app)
        .put(`/formularios/${formId}/schema_version`)
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schema_version).toBe(2);
      expect(mockFormService.atualizarSchemaFormulario).toHaveBeenCalledWith(
        formId,
        updatePayload
      );
    });

    it("deve retornar 409 se a versão do schema for inferior à atual", async () => {
      const formId = "form_001";
      mockFormService.atualizarSchemaFormulario.mockRejectedValue(
        new Error("Versão do schema 1 não é maior que a versão atual 2")
      );

      const response = await supertest(app)
        .put(`/formularios/${formId}/schema_version`)
        .send({ nome: "Updated Form" });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Versão do schema");
    });
  });

  describe("DELETE /formularios/:id", () => {
    it("deve desativar um formulário com sucesso e retornar 200", async () => {
      const formId = "form_001";
      const mockForm = {
        id: formId,
        nome: "Test Form",
        protegido: false,
        is_ativo: true,
        data_criacao: new Date(),
        campos: [],
      };
      mockFormService.obterFormularioPorId.mockResolvedValue(mockForm as any);
      mockFormService.desativarFormulario.mockResolvedValue(undefined);

      const response = await supertest(app).delete(`/formularios/${formId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockFormService.desativarFormulario).toHaveBeenCalledWith(
        formId,
        "usuario_admin"
      );
    });

    it("deve retornar 404 se o formulário não for encontrado", async () => {
      const formId = "form_nao_existe";
      mockFormService.obterFormularioPorId.mockResolvedValue(null);

      const response = await supertest(app).delete(`/formularios/${formId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Formulário não encontrado");
    });

    it("deve retornar 403 se o formulário estiver protegido", async () => {
      const formId = "form_protegido";
      const mockForm = {
        id: formId,
        nome: "Protected Form",
        protegido: true,
        is_ativo: true,
        data_criacao: new Date(),
        campos: [],
      };
      mockFormService.obterFormularioPorId.mockResolvedValue(mockForm as any);

      const response = await supertest(app).delete(`/formularios/${formId}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        "Formulário protegido não pode ser removido"
      );
    });
  });

  describe("POST /formularios/:id/respostas", () => {
    it("deve submeter uma resposta com sucesso e retornar 201", async () => {
      const formId = "form_001";
      const responsePayload = {
        schema_version: 1,
        respostas: { name: "John Doe" },
      };
      const mockResponseResult = {
        id: "resp_001",
        formId,
        ...responsePayload,
        calculados: {},
        criado_em: new Date(),
      };
      mockFormService.enviarResposta.mockResolvedValue(
        mockResponseResult as any
      );

      const response = await supertest(app)
        .post(`/formularios/${formId}/respostas`)
        .send(responsePayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe("resp_001");
      expect(mockFormService.enviarResposta).toHaveBeenCalledWith(
        formId,
        responsePayload.respostas,
        responsePayload.schema_version
      );
    });

    it("deve retornar 404 se o formulário não for encontrado", async () => {
      const formId = "form_nao_existe";
      mockFormService.enviarResposta.mockRejectedValue(
        new Error("Formulário não encontrado")
      );

      const response = await supertest(app)
        .post(`/formularios/${formId}/respostas`)
        .send({ respostas: {} });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Formulário não encontrado");
    });

    it("deve retornar 409 se a versão do schema estiver desatualizada", async () => {
      const formId = "form_001";
      mockFormService.enviarResposta.mockRejectedValue(
        new Error("Versão do schema desatualizada")
      );

      const response = await supertest(app)
        .post(`/formularios/${formId}/respostas`)
        .send({ schema_version: 1, respostas: { name: "John Doe" } });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Versão do schema desatualizada");
    });
  });

  describe("GET /formularios/:id/respostas", () => {
    it("deve listar respostas de um formulário com sucesso", async () => {
      const formId = "form_001";
      const mockResponses = [
        {
          id: "resp_001",
          criado_em: new Date(),
          schema_version: 1,
          respostas: {},
          is_ativo: true,
        },
        {
          id: "resp_002",
          criado_em: new Date(),
          schema_version: 1,
          respostas: {},
          is_ativo: true,
        },
      ];
      mockFormService.listarRespostas.mockResolvedValue(mockResponses as any);

      const response = await supertest(app).get(
        `/formularios/${formId}/respostas?pagina=1&tamanho_pagina=10`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.resultados).toHaveLength(2);
      expect(mockFormService.listarRespostas).toHaveBeenCalledWith(formId, {
        pagina: 1,
        tamanho_pagina: 10,
        filtros: { schema_version: undefined, incluir_inativos: undefined },
      });
    });

    it("deve retornar 404 se o formulário não for encontrado", async () => {
      const formId = "form_nao_existe";
      mockFormService.listarRespostas.mockRejectedValue(
        new Error("Formulário não encontrado")
      );

      const response = await supertest(app).get(
        `/formularios/${formId}/respostas`
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Formulário não encontrado");
    });
  });

  describe("DELETE /formularios/:id/respostas/:respostaId", () => {
    it("deve desativar uma resposta com sucesso e retornar 200", async () => {
      const formId = "form_001";
      const respostaId = "resp_001";
      mockFormService.desativarResposta.mockResolvedValue(undefined);

      const response = await supertest(app).delete(
        `/formularios/${formId}/respostas/${respostaId}`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockFormService.desativarResposta).toHaveBeenCalledWith(
        formId,
        respostaId,
        "usuario_admin"
      );
    });

    it("deve retornar 404 se a resposta não for encontrada", async () => {
      const formId = "form_001";
      const respostaId = "resp_nao_existe";
      mockFormService.desativarResposta.mockRejectedValue(
        new Error("Resposta não encontrada")
      );

      const response = await supertest(app).delete(
        `/formularios/${formId}/respostas/${respostaId}`
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Resposta não encontrada");
    });

    it("deve retornar 410 se a resposta já estiver inativa", async () => {
      const formId = "form_001";
      const respostaId = "resp_inativa";
      mockFormService.desativarResposta.mockRejectedValue(
        new Error("Resposta inativa")
      );

      const response = await supertest(app).delete(
        `/formularios/${formId}/respostas/${respostaId}`
      );

      expect(response.status).toBe(410);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Resposta inativa");
    });
  });
});
