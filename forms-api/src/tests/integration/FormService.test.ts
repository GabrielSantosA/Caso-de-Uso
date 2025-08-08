/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeepMockProxy, mockDeep } from "jest-mock-extended";
import { Calculator } from "../../core/app/services/Calculator";
import { FormService } from "../../core/app/use-cases/FormService";
import { Form, Response } from "../../core/domain/entities/Form";
import { FieldValidator } from "../../core/domain/ports/FieldValidator";
import { FormRepository } from "../../core/domain/ports/FormRepository";

describe("FormService", () => {
  let formRepository: DeepMockProxy<FormRepository>;
  let calculator: DeepMockProxy<Calculator>;
  let fieldValidator: DeepMockProxy<FieldValidator>;
  let formService: FormService;

  beforeEach(() => {
    formRepository = mockDeep<FormRepository>();
    calculator = mockDeep<Calculator>();
    fieldValidator = mockDeep<FieldValidator>();

    formService = new FormService(
      formRepository,
      calculator as any,
      fieldValidator as any
    );
  });

  describe("criarFormulario", () => {
    it("deve criar um novo formulário com sucesso e valores padrão", async () => {
      const formPayload = {
        nome: "Formulário de Teste",
        campos: [{ id: "campoA", tipo: "text", label: "Campo A" }],
      };
      const mockFormCriado = {
        ...formPayload,
        id: "form_001",
        schema_version: 1,
        is_ativo: true,
        data_criacao: new Date(),
        protegido: false,
      };

      fieldValidator.validate.mockResolvedValue(undefined);
      formRepository.create.mockResolvedValue(mockFormCriado as Form);

      const resultado = await formService.criarFormulario(formPayload as any);

      expect(resultado).toEqual(mockFormCriado);
      expect(resultado.schema_version).toBe(1);
      expect(resultado.is_ativo).toBe(true);
      expect(fieldValidator.validate).toHaveBeenCalledWith(
        undefined,
        formPayload.campos[0]
      );
      expect(formRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...formPayload,
          schema_version: 1,
          is_ativo: true,
          protegido: false,
        })
      );
    });

    it("deve lançar um erro para dependências circulares", async () => {
      const formPayloadComCiclo = {
        nome: "Formulário com Ciclo",
        campos: [
          { id: "campoA", tipo: "number", dependencias: ["campoB"] },
          { id: "campoB", tipo: "number", dependencias: ["campoA"] },
        ],
      };
      fieldValidator.validate.mockResolvedValue(undefined);

      await expect(
        formService.criarFormulario(formPayloadComCiclo as any)
      ).rejects.toThrow("Dependência circular detectada no campo: campoA");
      expect(formRepository.create).not.toHaveBeenCalled();
    });

    it("deve lançar um erro se a validação do campo falhar", async () => {
      const formPayloadInvalido = {
        nome: "Formulário Inválido",
        campos: [{ id: "campoInvalido", tipo: "text", obrigatorio: true }],
      };
      fieldValidator.validate.mockRejectedValue(
        new Error("Campo obrigatório ausente")
      );

      await expect(
        formService.criarFormulario(formPayloadInvalido as any)
      ).rejects.toThrow("Campo obrigatório ausente");
      expect(formRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("atualizarSchemaFormulario", () => {
    it("deve atualizar o schema e incrementar a versão com sucesso", async () => {
      const formId = "form_001";
      const formularioExistente = {
        id: formId,
        schema_version: 1,
        is_ativo: true,
        campos: [],
        nome: "Antigo Nome",
        data_criacao: new Date(),
        protegido: false,
      };
      const payloadAtualizacao = {
        nome: "Novo Nome",
        campos: [{ id: "campoB", tipo: "text", label: "Campo B" }],
      };
      const mockFormAtualizado = {
        ...formularioExistente,
        ...payloadAtualizacao,
        schema_version: 2,
      };

      formRepository.findById.mockResolvedValue(formularioExistente as Form);
      formRepository.updateSchema.mockResolvedValue(mockFormAtualizado as Form);
      fieldValidator.validate.mockResolvedValue(undefined);

      const resultado = await formService.atualizarSchemaFormulario(
        formId,
        payloadAtualizacao as any
      );

      expect(resultado.schema_version).toBe(2);
      expect(resultado.nome).toBe("Novo Nome");
      expect(formRepository.updateSchema).toHaveBeenCalledWith(
        formId,
        expect.objectContaining({ ...payloadAtualizacao, schema_version: 2 })
      );
    });

    it("deve lançar um erro se a versão do schema fornecida não for maior", async () => {
      const formId = "form_001";
      const formularioExistente = {
        id: formId,
        schema_version: 2,
        is_ativo: true,
      } as Form;
      formRepository.findById.mockResolvedValue(formularioExistente);

      await expect(
        formService.atualizarSchemaFormulario(formId, {
          schema_version: 1,
        } as any)
      ).rejects.toThrow("Versão do schema 1 não é maior que a versão atual 2");
      expect(formRepository.updateSchema).not.toHaveBeenCalled();
    });
  });

  describe("enviarResposta", () => {
    it("deve submeter uma resposta válida e calcular campos com sucesso", async () => {
      const formId = "form_002";
      const formularioComCalculo = {
        id: formId,
        schema_version: 1,
        is_ativo: true,
        campos: [
          { id: "numA", tipo: "number", label: "A" },
          { id: "numB", tipo: "number", label: "B" },
          {
            id: "total",
            tipo: "calculated",
            formula: "numA + numB",
            dependencias: ["numA", "numB"],
          },
        ],
      };
      const responsePayload = { numA: 10, numB: 20 };
      const mockRespostaSalva = {
        id: "resp_001",
        formId,
        respostas: responsePayload,
        calculados: { total: 30 },
        schema_version: 1,
        criado_em: new Date(),
        is_ativo: true,
      };

      formRepository.findById.mockResolvedValue(formularioComCalculo as any);
      fieldValidator.validate.mockResolvedValue(undefined);
      calculator.calculate.mockResolvedValue(30);
      formRepository.saveResponse.mockResolvedValue(
        mockRespostaSalva as Response
      );

      const resultado = await formService.enviarResposta(
        formId,
        responsePayload
      );

      expect(resultado.calculados).toEqual({ total: 30 });
      expect(calculator.calculate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "total" }),
        responsePayload
      );
      expect(formRepository.saveResponse).toHaveBeenCalledWith(
        formId,
        expect.objectContaining({
          respostas: responsePayload,
          calculados: { total: 30 },
          schema_version: 1,
        })
      );
    });

    it("deve lançar um erro se a validação do campo falhar", async () => {
      const formId = "form_001";
      const formulario = {
        id: formId,
        schema_version: 1,
        is_ativo: true,
        campos: [{ id: "nome", tipo: "text", obrigatorio: true }],
      };
      const responsePayload = { nome: null };

      formRepository.findById.mockResolvedValue(formulario as Form);
      fieldValidator.validate.mockRejectedValue(new Error("Campo inválido"));

      await expect(
        formService.enviarResposta(formId, responsePayload as any)
      ).rejects.toThrow("Campo inválido");
      expect(formRepository.saveResponse).not.toHaveBeenCalled();
    });

    it("deve lançar um erro se a versão do schema estiver desatualizada", async () => {
      const formId = "form_001";
      const formulario = {
        id: formId,
        schema_version: 2,
        is_ativo: true,
      } as Form;
      const responsePayload = { nome: "Teste" };

      formRepository.findById.mockResolvedValue(formulario);

      await expect(
        formService.enviarResposta(formId, responsePayload, 1)
      ).rejects.toThrow("Versão do schema desatualizada");
      expect(formRepository.saveResponse).not.toHaveBeenCalled();
    });
  });
});
