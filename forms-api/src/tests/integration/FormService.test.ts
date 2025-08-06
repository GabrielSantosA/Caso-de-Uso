/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeepMockProxy, mockDeep } from "jest-mock-extended";
import { Calculator } from "../../core/app/services/Calculator";
import { FormService } from "../../core/app/use-cases/FormService";
import { Field, Form } from "../../core/domain/entities/Form";
import { FieldValidator } from "../../core/domain/ports/FieldValidator";
import { FormRepository } from "../../core/domain/ports/FormRepository";

describe("FormService", () => {
  let formRepository: DeepMockProxy<FormRepository>;
  let calculator: Calculator;
  let textValidator: DeepMockProxy<FieldValidator>;
  let numberValidator: DeepMockProxy<FieldValidator>;
  let calculatedValidator: DeepMockProxy<FieldValidator>;
  let formService: FormService;

  type GenericResponse = {
    id: string;
    formId: string;
    respostas: Record<string, any>;
    calculados: Record<string, any>;
    schema_version: number;
    criado_em: Date;
    is_ativo: boolean;
  };

  beforeEach(() => {
    formRepository = mockDeep<FormRepository>();
    calculator = new Calculator();
    textValidator = mockDeep<FieldValidator>();
    numberValidator = mockDeep<FieldValidator>();
    calculatedValidator = mockDeep<FieldValidator>();

    const validators = {
      text: textValidator,
      number: numberValidator,
      calculated: calculatedValidator,
    };
    formService = new FormService(formRepository, calculator, validators);

    textValidator.validate.mockResolvedValue(undefined);
    numberValidator.validate.mockResolvedValue(undefined);
    calculatedValidator.validate.mockResolvedValue(undefined);
  });

  it("should create a new form with default values", async () => {
    const form: Form = {
      id: "form_001",
      nome: "Formulário de Teste",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: [],
    };
    formRepository.create.mockResolvedValue(form);
    const result = await formService.createForm(form);

    expect(result.schema_version).toBe(1);
    expect(result.is_ativo).toBe(true);
    expect(formRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Formulário de Teste",
        schema_version: 1,
      })
    );
  });

  it("should update a form's schema and increment version", async () => {
    const form: Form = {
      id: "form_001",
      nome: "Formulário de Teste",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: [],
    };
    const updatedFields: Field[] = [
      { id: "campo_novo", tipo: "text", label: "Novo Campo" },
    ];
    formRepository.findById.mockResolvedValue(form);
    formRepository.updateSchema.mockResolvedValue({
      ...form,
      schema_version: 2,
      campos: updatedFields,
    });

    const result = await formService.updateFormSchema("form_001", {
      campos: updatedFields,
    });

    expect(result.schema_version).toBe(2);
    expect(result.campos).toEqual(updatedFields);
    expect(formRepository.updateSchema).toHaveBeenCalledWith(
      "form_001",
      expect.objectContaining({ campos: updatedFields })
    );
  });

  it("should throw an error for circular dependencies on form creation", async () => {
    const fields: Field[] = [
      { id: "A", tipo: "text", label: "Campo A", dependencias: ["B"] },
      { id: "B", tipo: "text", label: "Campo B", dependencias: ["C"] },
      { id: "C", tipo: "text", label: "Campo C", dependencias: ["A"] },
    ];
    const circularForm: Form = {
      id: "circular_001",
      nome: "Formulário com dependência circular",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: fields,
    };
    await expect(formService.createForm(circularForm)).rejects.toThrow(
      "Circular dependency detected involving field: A"
    );
  });

  it("should throw an error for circular dependencies on schema update", async () => {
    const initialFields: Field[] = [
      { id: "A", tipo: "text", label: "Campo A", dependencias: [] },
    ];
    const form: Form = {
      id: "circular_001",
      nome: "Formulário com dependência circular",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: initialFields,
    };
    const fieldsWithCircularDependency: Field[] = [
      ...initialFields,
      { id: "B", tipo: "text", label: "Campo B", dependencias: ["A"] },
      { id: "C", tipo: "text", label: "Campo C", dependencias: ["B"] },
      { id: "A", tipo: "text", label: "Campo A", dependencias: ["C"] },
    ];
    formRepository.findById.mockResolvedValue(form);

    await expect(
      formService.updateFormSchema("circular_001", {
        campos: fieldsWithCircularDependency,
      })
    ).rejects.toThrow("Circular dependency detected involving field: A");
  });

  it("should soft delete a form", async () => {
    const form: Form = {
      id: "form_001",
      nome: "Formulário de Teste",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: [],
    };
    formRepository.findById.mockResolvedValue(form);
    formRepository.softDelete.mockResolvedValue(undefined);
    await expect(
      formService.softDelete("form_001", "user_test")
    ).resolves.toBeUndefined();
    expect(formRepository.softDelete).toHaveBeenCalledWith(
      "form_001",
      "user_test"
    );
  });

  it("should not soft delete a protected form", async () => {
    const form: Form = {
      id: "form_001",
      nome: "Formulário Protegido",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: true,
      campos: [],
    };
    formRepository.findById.mockResolvedValue(form);
    await expect(
      formService.softDelete("form_001", "user_test")
    ).rejects.toThrow("Não é possível remover formulários protegidos.");
    expect(formRepository.softDelete).not.toHaveBeenCalled();
  });

  it("should submit a valid response", async () => {
    const form: Form = {
      id: "form_001",
      nome: "Formulário de Resposta",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: [{ id: "campoA", tipo: "number", label: "Campo A" }],
    };
    const responseData = { campoA: 10 };
    const savedResponse: GenericResponse = {
      id: `resposta_${Date.now()}`,
      formId: "form_001",
      respostas: responseData,
      calculados: {},
      schema_version: 1,
      criado_em: new Date(),
      is_ativo: true,
    };
    formRepository.findById.mockResolvedValue(form);
    formRepository.saveResponse.mockResolvedValue(savedResponse);
    numberValidator.validate.mockResolvedValue(undefined); // ✅ CORRIGIDO

    const result = await formService.submitResponse("form_001", responseData);
    expect(result.respostas).toEqual(responseData);
    expect(numberValidator.validate).toHaveBeenCalledWith(10, form.campos[0]);
    expect(formRepository.saveResponse).toHaveBeenCalledWith(
      "form_001",
      expect.objectContaining({ respostas: responseData })
    );
  });

  it("should submit a response with a calculated field", async () => {
    const form: Form = {
      id: "form_002",
      nome: "Formulário com Cálculo",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: [
        { id: "campoA", tipo: "number", label: "Campo A" },
        { id: "campoB", tipo: "number", label: "Campo B" },
        {
          id: "resultado",
          tipo: "calculated",
          label: "Resultado",
          formula: "campoA + campoB",
          dependencias: ["campoA", "campoB"],
        },
      ],
    };
    const responseData = { campoA: 5, campoB: 15 };
    const savedResponse: GenericResponse = {
      id: `resposta_${Date.now()}`,
      formId: "form_002",
      respostas: responseData,
      calculados: { resultado: 20 },
      schema_version: 1,
      criado_em: new Date(),
      is_ativo: true,
    };
    formRepository.findById.mockResolvedValue(form);
    formRepository.saveResponse.mockResolvedValue(savedResponse);
    jest.spyOn(calculator, "calculate").mockResolvedValue(20);
    // ✅ CORRIGIDO: Mocks individuais dentro do teste também devem usar mockResolvedValue()
    numberValidator.validate.mockResolvedValue(undefined);
    calculatedValidator.validate.mockResolvedValue(undefined);

    const result = await formService.submitResponse("form_002", responseData);
    expect(result.calculados).toEqual({ resultado: 20 });
    expect(numberValidator.validate).toHaveBeenCalledTimes(2);
    expect(numberValidator.validate).toHaveBeenCalledWith(5, form.campos[0]);
    expect(numberValidator.validate).toHaveBeenCalledWith(15, form.campos[1]);
    expect(formRepository.saveResponse).toHaveBeenCalledWith(
      "form_002",
      expect.objectContaining({ calculados: { resultado: 20 } })
    );
  });

  it("should list active forms", async () => {
    const forms: Form[] = [
      {
        id: "f1",
        nome: "Form 1",
        is_ativo: true,
        data_criacao: new Date(),
        schema_version: 1,
        campos: [],
        protegido: false,
      },
    ];
    formRepository.list.mockResolvedValue(forms);
    const result = await formService.listForms({
      page: 1,
      pageSize: 10,
    });
    expect(result).toEqual(forms);
    expect(formRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10 })
    );
  });

  it("should get a form by ID", async () => {
    const form: Form = {
      id: "f1",
      nome: "Form 1",
      is_ativo: true,
      data_criacao: new Date(),
      schema_version: 1,
      campos: [],
      protegido: false,
    };
    formRepository.findById.mockResolvedValue(form);
    const result = await formService.getFormById("f1");
    expect(result).toEqual(form);
    expect(formRepository.findById).toHaveBeenCalledWith("f1");
  });

  it("should soft delete a response", async () => {
    const formId = "form_001";
    const responseId = "resp_001";
    const responseToMock: GenericResponse = {
      id: responseId,
      formId,
      respostas: {},
      calculados: {},
      schema_version: 1,
      criado_em: new Date(),
      is_ativo: true,
    };
    formRepository.findResponseById.mockResolvedValue(responseToMock);
    formRepository.softDeleteResponse.mockResolvedValue(undefined);
    await expect(
      formService.softDeleteResponse(formId, responseId, "user_test")
    ).resolves.toBeUndefined();
    expect(formRepository.softDeleteResponse).toHaveBeenCalledWith(
      formId,
      responseId,
      "user_test"
    );
  });
});
