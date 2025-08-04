/* eslint-disable @typescript-eslint/no-explicit-any */
import { evaluate } from "mathjs";
import { createLogger, format, transports } from "winston";
import { FormRepository } from "../../../../domain/entities/ports/FormRepository";
import { ValidatorStrategy } from "../../../../domain/entities/rules/validators/Validator";
import { Field, Form, Response } from "../../Form";
import { Calculator } from "../../infra/calculation/Calculator";

const logger = createLogger({
  transports: [new transports.File({ filename: "audit.log" })],
  format: format.combine(format.timestamp(), format.json()),
});

export class FormService {
  constructor(
    private formRepository: FormRepository,
    private calculator: Calculator,
    private validators: Record<string, ValidatorStrategy>
  ) {}

  async createForm(form: Form): Promise<Form> {
    for (const field of form.campos) {
      const validator = this.validators[field.tipo];
      if (!validator) throw new Error(`No validator for type ${field.tipo}`);
      await validator.validate(field, field);
    }

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

  async listForms(params: Parameters<FormRepository["list"]>[0]) {
    return this.formRepository.list(params);
  }

  async getFormById(id: string) {
    return this.formRepository.findById(id);
  }

  async listFormResponses(
    formId: string,
    params: Parameters<FormRepository["listResponses"]>[1]
  ) {
    return this.formRepository.listResponses(formId, params);
  }

  async updateFormSchema(
    id: string,
    updatedForm: Partial<Form>
  ): Promise<Form> {
    const existingForm = await this.formRepository.findById(id);
    if (!existingForm || !existingForm.is_ativo) {
      throw new Error("Form not found or inactive");
    }

    for (const field of updatedForm.campos || []) {
      const validator = this.validators[field.tipo];
      if (!validator) throw new Error(`No validator for type ${field.tipo}`);
      await validator.validate(field, field);
    }

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

  async softDelete(id: string, user: string): Promise<void> {
    await this.formRepository.softDelete(id, user);
  }

  async softDeleteResponse(
    formId: string,
    responseId: string,
    user: string
  ): Promise<void> {
    await this.formRepository.softDeleteResponse(formId, responseId, user);
  }

  async submitResponse(
    formId: string,
    response: Record<string, any>,
    schema_version?: number
  ): Promise<Response> {
    const form = await this.formRepository.findById(formId);
    if (!form || !form.is_ativo) throw new Error("Form not found or inactive");

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

    const calculated: Record<string, any> = {};
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

  private evaluateConditional(
    conditional: string,
    values: Record<string, any>
  ): boolean {
    try {
      return evaluate(conditional, values);
    } catch (error) {
      throw new Error(`Invalid conditional expression: ${conditional}`);
    }
  }

  private checkCircularDependencies(fields: Field[]): void {
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();
    const recStack = new Set<string>();

    fields.forEach((field) => {
      if (field.dependencias) {
        graph.set(field.id, field.dependencias);
      } else {
        graph.set(field.id, []);
      }
    });

    const detectCycle = (node: string): void => {
      visited.add(node);
      recStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
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
      if (!visited.has(node)) {
        detectCycle(node);
      }
    }
  }
}
