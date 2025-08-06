import { inject, injectable } from "tsyringe";
import { createLogger, format, transports } from "winston";
import { Field, Form, Response } from "../../domain/entities/Form";
import { FormRepository } from "../../domain/ports/FormRepository";
import { ValidatorStrategy } from "../../infra/adapters/validators/Validator";
import { Calculator } from "../services/Calculator";

const logger = createLogger({
  transports: [new transports.File({ filename: "audit.log" })],
  format: format.combine(format.timestamp(), format.json()),
});

@injectable()
export class FormService {
  constructor(
    @inject("FormRepository") private formRepository: FormRepository,
    @inject("Calculator") private calculator: Calculator,
    @inject("FieldValidator")
    private validators: Record<string, ValidatorStrategy>
  ) {}

  async createForm(form: Form): Promise<Form> {
    await this.validateFields(form.campos);
    this.checkCircularDependencies(form.campos);

    const newForm = await this.formRepository.create({
      ...form,
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: form.protegido ?? false,
    });

    logger.info({
      acao: "criacao_formulario",
      id: newForm.id,
      usuario: "system",
      timestamp: new Date().toISOString(),
    });
    return newForm;
  }

  async updateFormSchema(
    id: string,
    updatedForm: Partial<Form>
  ): Promise<Form> {
    const existingForm = await this.formRepository.findById(id);
    if (!existingForm) throw new Error("Form not found");
    if (!existingForm.is_ativo) throw new Error("Form is inactive");

    await this.validateFields(updatedForm.campos || []);
    this.checkCircularDependencies(updatedForm.campos || []);

    const newSchemaVersion = existingForm.schema_version + 1;
    if (
      updatedForm.schema_version &&
      updatedForm.schema_version <= existingForm.schema_version
    ) {
      throw new Error(
        `Schema version ${updatedForm.schema_version} is not greater than current version ${existingForm.schema_version}`
      );
    }

    const updated = await this.formRepository.updateSchema(id, {
      ...updatedForm,
      schema_version: newSchemaVersion,
      data_criacao: existingForm.data_criacao,
      is_ativo: existingForm.is_ativo,
      protegido: existingForm.protegido,
    });

    logger.info({
      acao: "atualizacao_schema",
      id,
      schema_version_anterior: existingForm.schema_version,
      schema_version_nova: newSchemaVersion,
      usuario: "system",
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  async submitResponse(
    formId: string,
    response: Record<string, unknown>,
    schema_version?: number
  ): Promise<Response> {
    const form = await this.formRepository.findById(formId);
    if (!form) throw new Error("Form not found");
    if (!form.is_ativo) throw new Error("Form is inactive");

    const targetVersion = schema_version || form.schema_version;
    if (targetVersion !== form.schema_version) {
      throw new Error("Schema version outdated");
    }

    for (const field of form.campos) {
      if (field.tipo === "calculated") continue;
      if (
        field.condicional &&
        !this.evaluateConditional(field.condicional, response)
      )
        continue;
      const validator = this.validators[field.tipo];
      await validator.validate(response[field.id], field);
    }

    const calculated: Record<string, unknown> = {};
    for (const field of form.campos.filter(
      (f: { tipo: string }) => f.tipo === "calculated"
    )) {
      calculated[field.id] = await this.calculator.calculate(field, response);
    }

    const savedResponse = await this.formRepository.saveResponse(formId, {
      id: `resposta_${Date.now()}`,
      formId,
      respostas: response,
      calculados: calculated,
      schema_version: targetVersion,
      criado_em: new Date(),
      is_ativo: true,
    });

    logger.info({
      acao: "submissao_resposta",
      id_formulario: formId,
      id_resposta: savedResponse.id,
      usuario: "system",
      timestamp: new Date().toISOString(),
    });

    return savedResponse;
  }

  async listForms(params: {
    nome?: string;
    schema_version?: number;
    page: number;
    pageSize: number;
    incluirInativos?: boolean;
    ordenarPor?: string;
    ordem?: "asc" | "desc";
  }): Promise<Form[]> {
    const forms = await this.formRepository.list(params);
    logger.info({
      acao: "listagem_formularios",
      quantidade: forms.length,
      usuario: "system",
      timestamp: new Date().toISOString(),
    });
    return forms;
  }

  async getFormById(id: string): Promise<Form | null> {
    const form = await this.formRepository.findById(id);
    if (form) {
      logger.info({
        acao: "busca_formulario",
        id,
        usuario: "system",
        timestamp: new Date().toISOString(),
      });
    }
    return form;
  }

  async softDelete(id: string, user: string): Promise<void> {
    const existingForm = await this.formRepository.findById(id);
    if (!existingForm) throw new Error("Form not found");
    if (!existingForm.is_ativo) throw new Error("Form is inactive");

    await this.formRepository.softDelete(id, user);

    logger.info({
      acao: "exclusao_logica_formulario",
      id,
      usuario: user,
      timestamp: new Date().toISOString(),
    });
  }

  async listResponses(
    formId: string,
    params: {
      page: number;
      pageSize: number;
      filters?: Record<string, unknown>;
    }
  ): Promise<Response[]> {
    const responses = await this.formRepository.listResponses(formId, params);
    logger.info({
      acao: "listagem_respostas",
      id_formulario: formId,
      quantidade: responses.length,
      usuario: "system",
      timestamp: new Date().toISOString(),
    });
    return responses;
  }

  async softDeleteResponse(
    formId: string,
    responseId: string,
    user: string
  ): Promise<void> {
    const response = await this.formRepository.findResponseById(
      formId,
      responseId
    );
    if (!response) throw new Error("Response not found");
    if (!response.is_ativo) throw new Error("Response is inactive");

    await this.formRepository.softDeleteResponse(formId, responseId, user);

    logger.info({
      acao: "exclusao_logica_resposta",
      id_formulario: formId,
      id_resposta: responseId,
      usuario: user,
      timestamp: new Date().toISOString(),
    });
  }

  private async validateFields(fields: Field[]): Promise<void> {
    for (const field of fields) {
      const validator = this.validators[field.tipo];
      if (!validator) throw new Error(`No validator for type ${field.tipo}`);
      await validator.validate(undefined, field);
    }
  }

  private evaluateConditional(
    conditional: string,
    values: Record<string, unknown>
  ): boolean {
    try {
      const [fieldId, expectedValue] = conditional.split("=");
      if (!fieldId || !expectedValue)
        throw new Error("Invalid conditional format");
      const value = values[fieldId];
      return value === expectedValue;
    } catch (error) {
      throw new Error(`Invalid conditional expression: ${conditional}`);
    }
  }

  private checkCircularDependencies(fields: Field[]): void {
    const graph = new Map<string, string[]>();
    fields.forEach((field) => graph.set(field.id, field.dependencias || []));

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const detectCycle = (node: string): void => {
      visited.add(node);
      recStack.add(node);

      for (const neighbor of graph.get(node) || []) {
        if (!visited.has(neighbor)) {
          detectCycle(neighbor);
        } else if (recStack.has(neighbor)) {
          throw new Error(
            `Circular dependency detected involving field: ${neighbor}`
          );
        }
      }

      recStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) detectCycle(node);
    }
  }
}
