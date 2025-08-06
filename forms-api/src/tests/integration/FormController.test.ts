/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import { mockDeep } from "jest-mock-extended";
import supertest from "supertest";
import { Calculator } from "../../core/app/services/Calculator";
import { FormService } from "../../core/app/use-cases/FormService";
import { FieldValidator } from "../../core/domain/ports/FieldValidator";
import { FormRepository } from "../../core/domain/ports/FormRepository";
import { FormController } from "../../core/infra/adapters/controllers/FormController";

describe("FormController", () => {
  const app = express();
  const formRepository = mockDeep<FormRepository>();
  const calculator = new Calculator();
  const validators = {
    text: new FieldValidator(),
    number: new FieldValidator(),
    boolean: new FieldValidator(),
    date: new FieldValidator(),
    select: new FieldValidator(),
    calculated: new FieldValidator(),
  };
  const formService = new FormService(formRepository, calculator, validators);
  const formController = new FormController(formService);

  app.use(express.json());
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

  it("should create a form successfully", async () => {
    formRepository.create.mockResolvedValue({
      id: "form_001",
      schema_version: 1,
      data_criacao: new Date(),
      nome: "Test Form",
      is_ativo: true,
      protegido: false,
      campos: [{ id: "name", tipo: "text", label: "Name", obrigatorio: true }],
    } as any);

    const response = await supertest(app)
      .post("/formularios")
      .send({
        nome: "Test Form",
        campos: [
          { id: "name", tipo: "text", label: "Name", obrigatorio: true },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "form_001",
      schema_version: 1,
      mensagem: "Formulário criado com sucesso",
      criado_em: expect.any(String),
    });
  });

  it("should update form schema and increment schema_version", async () => {
    formRepository.findById.mockResolvedValue({
      id: "form_001",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: [],
    } as any);
    formRepository.updateSchema.mockResolvedValue({
      id: "form_001",
      schema_version: 2,
      nome: "Updated Form",
    } as any);

    const response = await supertest(app)
      .put("/formularios/form_001/schema_version")
      .send({
        nome: "Updated Form",
        campos: [
          { id: "name", tipo: "text", label: "Name", obrigatorio: true },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      mensagem: "Versão atualizada com sucesso.",
      id: "form_001",
      schema_version_anterior: 1,
      schema_version_nova: 2,
      atualizado_em: expect.any(String),
    });
  });

  it("should reject form with circular dependencies", async () => {
    formRepository.create.mockRejectedValue(
      new Error("Circular dependency detected involving field: imc")
    );

    const response = await supertest(app)
      .post("/formularios")
      .send({
        nome: "Cyclic Form",
        campos: [
          {
            id: "imc",
            tipo: "calculated",
            label: "IMC",
            formula: "peso / (altura/100)^2",
            dependencias: ["peso", "altura", "classificacao"],
          },
          {
            id: "classificacao",
            tipo: "calculated",
            label: "Classificação",
            formula: 'if imc > 30 then "Obesidade" else "Normal"',
            dependencias: ["imc"],
          },
          { id: "peso", tipo: "number", label: "Peso" },
          { id: "altura", tipo: "number", label: "Altura" },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      erro: "payload_invalido",
      mensagem: "Circular dependency detected involving field: imc",
    });
  });

  it("should soft delete a form", async () => {
    formRepository.findById.mockResolvedValue({
      id: "form_001",
      is_ativo: true,
      protegido: false,
    } as any);
    formRepository.softDelete.mockResolvedValue();

    const response = await supertest(app).delete("/formularios/form_001");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      mensagem: "Formulário 'form_001' marcado como removido com sucesso.",
      status: "soft_deleted",
    });
  });

  it("should submit a response with conditional field", async () => {
    formRepository.findById.mockResolvedValue({
      id: "form_001",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: [
        { id: "altura", label: "Altura", tipo: "number", obrigatorio: true },
        { id: "peso", label: "Peso", tipo: "number", obrigatorio: true },
        {
          id: "sexo",
          label: "Sexo",
          tipo: "select",
          obrigatorio: true,
          opcoes: [
            { label: "Masculino", value: "masculino" },
            { label: "Feminino", value: "feminino" },
          ],
        },
        {
          id: "gravidez",
          label: "Gravidez",
          tipo: "boolean",
          condicional: "sexo === 'feminino'",
          obrigatorio: true,
        },
        {
          id: "imc",
          label: "IMC",
          tipo: "calculated",
          formula: "peso / (altura/100)^2",
          dependencias: ["peso", "altura"],
        },
      ],
    } as any);
    formRepository.saveResponse.mockResolvedValue({
      id: "resposta_001",
      formId: "form_001",
      schema_version: 1,
      respostas: { altura: 170, peso: 70, sexo: "feminino", gravidez: false },
      calculados: { imc: 24.221453287197235 },
      criado_em: new Date(),
      is_ativo: true,
    } as any);

    const response = await supertest(app)
      .post("/formularios/form_001/respostas")
      .send({
        schema_version: 1,
        respostas: {
          altura: 170,
          peso: 70,
          sexo: "feminino",
          gravidez: false,
        },
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      mensagem: "Resposta registrada com sucesso.",
      id_resposta: "resposta_001",
      calculados: { imc: 24.221453287197235 },
      executado_em: expect.any(String),
    });
  });

  it("should skip conditional field validation when condition is false", async () => {
    formRepository.findById.mockResolvedValue({
      id: "form_001",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: [
        { id: "altura", label: "Altura", tipo: "number", obrigatorio: true },
        { id: "peso", label: "Peso", tipo: "number", obrigatorio: true },
        {
          id: "sexo",
          label: "Sexo",
          tipo: "select",
          obrigatorio: true,
          opcoes: [
            { label: "Masculino", value: "masculino" },
            { label: "Feminino", value: "feminino" },
          ],
        },
        {
          id: "gravidez",
          label: "Gravidez",
          tipo: "boolean",
          condicional: "sexo === 'feminino'",
          obrigatorio: true,
        },
        {
          id: "imc",
          label: "IMC",
          tipo: "calculated",
          formula: "peso / (altura/100)^2",
          dependencias: ["peso", "altura"],
        },
      ],
    } as any);
    formRepository.saveResponse.mockResolvedValue({
      id: "resposta_002",
      formId: "form_001",
      schema_version: 1,
      respostas: { altura: 170, peso: 70, sexo: "masculino" },
      calculados: { imc: 24.221453287197235 },
      criado_em: new Date(),
      is_ativo: true,
    } as any);

    const response = await supertest(app)
      .post("/formularios/form_001/respostas")
      .send({
        schema_version: 1,
        respostas: {
          altura: 170,
          peso: 70,
          sexo: "masculino",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      mensagem: "Resposta registrada com sucesso.",
      id_resposta: "resposta_002",
      calculados: { imc: 24.221453287197235 },
      executado_em: expect.any(String),
    });
  });

  it("should list responses", async () => {
    formRepository.listResponses.mockResolvedValue([
      {
        id: "resposta_001",
        formId: "form_001",
        schema_version: 1,
        respostas: { name: "John Doe" },
        calculados: { imc: 24.5 },
        criado_em: new Date(),
        is_ativo: true,
      } as any,
    ]);

    const response = await supertest(app).get(
      "/formularios/form_001/respostas?incluir_calculados=true"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      pagina: 1,
      tamanho_pagina: 20,
      total: 1,
      resultados: [
        {
          id_resposta: "resposta_001",
          criado_em: expect.any(String),
          schema_version: 1,
          respostas: { name: "John Doe" },
          calculados: { imc: 24.5 },
        },
      ],
    });
  });
});
