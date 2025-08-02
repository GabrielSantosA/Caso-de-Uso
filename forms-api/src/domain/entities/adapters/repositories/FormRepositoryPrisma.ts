/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import { Form, Response } from "../../Form";
import { FormRepository } from "../../ports/FormRepository";

export class FormRepositoryPrisma implements FormRepository {
  constructor(private prisma: PrismaClient) {}

  async create(form: Form): Promise<Form> {
    return this.prisma.form.create({
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
  }

  async findById(id: string): Promise<Form | null> {
    return this.prisma.form.findUnique({ where: { id } });
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
    return this.prisma.form.findMany({
      where: {
        nome: nome ? { contains: nome, mode: "insensitive" } : undefined,
        schema_version,
        is_ativo: incluirInativos ? undefined : true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: ordenarPor ? { [ordenarPor]: ordem || "asc" } : undefined,
    });
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
    return this.prisma.form.update({
      where: { id },
      data: {
        nome: form.nome,
        descricao: form.descricao,
        schema_version: form.schema_version,
        campos: form.campos as any,
      },
    });
  }

  async saveResponse(formId: string, response: Response): Promise<Response> {
    return this.prisma.response.create({
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
  }

  async listResponses(
    formId: string,
    params: { page: number; pageSize: number; filters?: any }
  ): Promise<Response[]> {
    const { page, pageSize, filters } = params;
    return this.prisma.response.findMany({
      where: {
        formId,
        schema_version: filters?.schema_version,
        is_ativo: filters?.incluir_calculados ? undefined : true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
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
