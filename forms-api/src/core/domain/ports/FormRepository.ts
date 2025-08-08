/* eslint-disable @typescript-eslint/no-explicit-any */
import { Form, Response } from "../entities/Form";

export interface FormRepository {
  findAll(): Promise<Form[]>;
  findResponsesByFormId(formId: string): Promise<Response[]>;
  findResponseById(
    formId: string,
    responseId: string
  ): Promise<Response | null>;
  create(form: Form): Promise<Form>;
  findById(id: string): Promise<Form | null>;

  list(params: {
    nome?: string;
    schema_version?: number;
    pagina: number;
    tamanho_pagina: number;
    incluirInativos?: boolean;
    ordenarPor?: string;
    ordem?: "asc" | "desc";
  }): Promise<Form[]>;

  softDelete(id: string, user: string): Promise<void>;
  updateSchema(id: string, form: Partial<Form>): Promise<Form>;
  saveResponse(formId: string, response: Response): Promise<Response>;

  listResponses(
    formId: string,
    params: {
      pagina: number;
      tamanho_pagina: number;
      filters?: {
        id?: string;
        schema_version?: number;
        incluir_inativos?: boolean;
      };
    }
  ): Promise<Response[]>;

  softDeleteResponse(
    formId: string,
    responseId: string,
    user: string
  ): Promise<void>;
}
