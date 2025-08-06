/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import { Field, Form, Response } from "../../../domain/entities/Form";
import { FormRepository } from "../../../domain/ports/FormRepository";

export class FormRepositoryPrisma implements FormRepository {
  constructor(private prisma: PrismaClient) {}

  private convertPrismaFormToForm(prismaForm: any): Form {
    return {
      ...prismaForm,
      descricao: prismaForm.descricao ?? undefined,
      data_remocao: prismaForm.data_remocao ?? undefined,
      usuario_remocao: prismaForm.usuario_remocao ?? undefined,
      campos: prismaForm.campos as Field[],
    };
  }

  private convertPrismaResponseToResponse(prismaResponse: any): Response {
    return {
      ...prismaResponse,
      data_remocao: prismaResponse.data_remocao ?? undefined,
      usuario_remocao: prismaResponse.usuario_remocao ?? undefined,
    };
  }

  async findAll(): Promise<Form[]> {
    const forms = await this.prisma.form.findMany({
      where: { is_ativo: true },
    });
    return forms.map(this.convertPrismaFormToForm);
  }

  async findResponsesByFormId(formId: string): Promise<Response[]> {
    const responses = await this.prisma.response.findMany({
      where: {
        formId,
        is_ativo: true,
      },
    });
    return responses.map(this.convertPrismaResponseToResponse);
  }

  async findResponseById(
    formId: string,
    responseId: string
  ): Promise<Response | null> {
    const response = await this.prisma.response.findUnique({
      where: {
        id: responseId,
        formId,
      },
    });
    return response ? this.convertPrismaResponseToResponse(response) : null;
  }

  async create(form: Form): Promise<Form> {
    const createdForm = await this.prisma.form.create({
      data: {
        id: form.id,
        nome: form.nome,
        descricao: form.descricao,
        schema_version: form.schema_version,
        is_ativo: form.is_ativo,
        data_criacao: form.data_criacao,
        protegido: form.protegido,
        campos: form.campos as any,
      },
    });
    return this.convertPrismaFormToForm(createdForm);
  }

  async findById(id: string): Promise<Form | null> {
    const form = await this.prisma.form.findUnique({ where: { id } });
    return form ? this.convertPrismaFormToForm(form) : null;
  }

  async list(params: {
    nome?: string;
    schema_version?: number;
    page: number;
    pageSize: number;
    incluirInativos?: boolean;
    ordenarPor?: string;
    ordem?: "asc" | "desc";
  }): Promise<Form[]> {
    const {
      nome,
      schema_version,
      page,
      pageSize,
      incluirInativos,
      ordenarPor,
      ordem,
    } = params;

    const forms = await this.prisma.form.findMany({
      where: {
        nome: nome ? { contains: nome, mode: "insensitive" } : undefined,
        schema_version,
        is_ativo: incluirInativos ? undefined : true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: ordenarPor ? { [ordenarPor]: ordem || "asc" } : undefined,
    });
    return forms.map(this.convertPrismaFormToForm);
  }

  async softDelete(id: string, user: string): Promise<void> {
    await this.prisma.form.update({
      where: { id },
      data: {
        is_ativo: false,
        data_remocao: new Date(),
        usuario_remocao: user,
      },
    });
  }

  async updateSchema(id: string, form: Partial<Form>): Promise<Form> {
    const updatedForm = await this.prisma.form.update({
      where: { id },
      data: {
        nome: form.nome,
        descricao: form.descricao,
        schema_version: form.schema_version,
        campos: form.campos as any,
      },
    });
    return this.convertPrismaFormToForm(updatedForm);
  }

  async saveResponse(formId: string, response: Response): Promise<Response> {
    const createdResponse = await this.prisma.response.create({
      data: {
        id: response.id,
        formId,
        schema_version: response.schema_version,
        respostas: response.respostas as any,
        calculados: response.calculados as any,
        criado_em: response.criado_em,
        is_ativo: response.is_ativo,
      },
    });
    return this.convertPrismaResponseToResponse(createdResponse);
  }

  async listResponses(
    formId: string,
    params: {
      page: number;
      pageSize: number;
      filters?: Record<string, unknown>;
    }
  ): Promise<Response[]> {
    const { page, pageSize, filters } = params;
    const responses = await this.prisma.response.findMany({
      where: {
        formId,
        schema_version: filters?.schema_version as number | undefined,
        is_ativo: filters?.incluir_calculados ? undefined : true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return responses.map(this.convertPrismaResponseToResponse);
  }

  async softDeleteResponse(
    formId: string,
    responseId: string,
    user: string
  ): Promise<void> {
    await this.prisma.response.update({
      where: { id: responseId, formId },
      data: {
        is_ativo: false,
        data_remocao: new Date(),
        usuario_remocao: user,
      },
    });
  }
}
