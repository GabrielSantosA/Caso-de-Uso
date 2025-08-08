import { inject, injectable } from "tsyringe";
import { createLogger, format, transports } from "winston";
import { Field, Form, Response } from "../../domain/entities/Form";
import { FieldValidator } from "../../domain/ports/FieldValidator";
import { FormRepository } from "../../domain/ports/FormRepository";
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
    @inject("FieldValidator") private fieldValidator: FieldValidator
  ) {}

  async criarFormulario(form: Form): Promise<Form> {
    await this.validarCampos(form.campos);
    this.verificarDependenciasCirculares(form.campos);

    const novoFormulario = await this.formRepository.create({
      ...form,
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: form.protegido ?? false,
    });

    logger.info({
      acao: "criacao_formulario",
      id: novoFormulario.id,
      usuario: "system",
      timestamp: new Date().toISOString(),
    });
    return novoFormulario;
  }

  async atualizarSchemaFormulario(
    id: string,
    formularioAtualizado: Partial<Form>
  ): Promise<Form> {
    const formularioExistente = await this.formRepository.findById(id);
    if (!formularioExistente) throw new Error("Formulário não encontrado");
    if (!formularioExistente.is_ativo) throw new Error("Formulário inativo");

    await this.validarCampos(formularioAtualizado.campos || []);
    this.verificarDependenciasCirculares(formularioAtualizado.campos || []);

    const novaVersaoSchema = formularioExistente.schema_version + 1;
    if (
      formularioAtualizado.schema_version &&
      formularioAtualizado.schema_version <= formularioExistente.schema_version
    ) {
      throw new Error(
        `Versão do schema ${formularioAtualizado.schema_version} não é maior que a versão atual ${formularioExistente.schema_version}`
      );
    }

    const atualizado = await this.formRepository.updateSchema(id, {
      ...formularioAtualizado,
      schema_version: novaVersaoSchema,
      data_criacao: formularioExistente.data_criacao,
      is_ativo: formularioExistente.is_ativo,
      protegido: formularioExistente.protegido,
    });

    logger.info({
      acao: "atualizacao_schema",
      id,
      schema_version_anterior: formularioExistente.schema_version,
      schema_version_nova: novaVersaoSchema,
      usuario: "system",
      timestamp: new Date().toISOString(),
    });

    return atualizado;
  }

  async enviarResposta(
    formId: string,
    respostas: Record<string, unknown>,
    schema_version?: number
  ): Promise<Response> {
    const formulario = await this.formRepository.findById(formId);
    if (!formulario) throw new Error("Formulário não encontrado");
    if (!formulario.is_ativo) throw new Error("Formulário inativo");

    const versaoAlvo = schema_version || formulario.schema_version;
    if (versaoAlvo !== formulario.schema_version) {
      throw new Error("Versão do schema desatualizada");
    }

    for (const campo of formulario.campos) {
      if (campo.tipo === "calculated") continue;
      if (
        campo.condicional &&
        !this.avaliarCondicional(campo.condicional, respostas)
      )
        continue;

      await this.fieldValidator.validate(respostas[campo.id], campo);
    }

    const camposCalculados: Record<string, unknown> = {};
    for (const campo of formulario.campos.filter(
      (f: { tipo: string }) => f.tipo === "calculated"
    )) {
      camposCalculados[campo.id] = await this.calculator.calculate(
        campo,
        respostas
      );
    }

    const respostaSalva = await this.formRepository.saveResponse(formId, {
      id: `resposta_${Date.now()}`,
      formId,
      respostas,
      calculados: camposCalculados,
      schema_version: versaoAlvo,
      criado_em: new Date(),
      is_ativo: true,
    });

    logger.info({
      acao: "submissao_resposta",
      id_formulario: formId,
      id_resposta: respostaSalva.id,
      usuario: "system",
      timestamp: new Date().toISOString(),
    });

    return respostaSalva;
  }

  async listarFormularios(params: {
    nome?: string;
    schema_version?: number;
    pagina: number;
    tamanho_pagina: number;
    incluirInativos?: boolean;
    ordenarPor?: string;
    ordem?: "asc" | "desc";
  }): Promise<Form[]> {
    const formularios = await this.formRepository.list({
      nome: params.nome,
      schema_version: params.schema_version,
      pagina: params.pagina,
      tamanho_pagina: params.tamanho_pagina,
      incluirInativos: params.incluirInativos,
      ordenarPor: params.ordenarPor,
      ordem: params.ordem,
    });

    logger.info({
      acao: "listagem_formularios",
      quantidade: formularios.length,
      usuario: "system",
      timestamp: new Date().toISOString(),
    });
    return formularios;
  }

  async obterFormularioPorId(id: string): Promise<Form | null> {
    const formulario = await this.formRepository.findById(id);
    if (formulario) {
      logger.info({
        acao: "busca_formulario",
        id,
        usuario: "system",
        timestamp: new Date().toISOString(),
      });
    }
    return formulario;
  }

  async desativarFormulario(id: string, usuario: string): Promise<void> {
    const formularioExistente = await this.formRepository.findById(id);
    if (!formularioExistente) throw new Error("Formulário não encontrado");
    if (!formularioExistente.is_ativo) throw new Error("Formulário inativo");

    await this.formRepository.softDelete(id, usuario);

    logger.info({
      acao: "exclusao_logica_formulario",
      id,
      usuario,
      timestamp: new Date().toISOString(),
    });
  }

  async listarRespostas(
    formId: string,
    params: {
      pagina: number;
      tamanho_pagina: number;
      filtros?: {
        id?: string;
        schema_version?: number;
        incluir_inativos?: boolean;
      };
    }
  ): Promise<Response[]> {
    const respostas = await this.formRepository.listResponses(formId, {
      pagina: params.pagina,
      tamanho_pagina: params.tamanho_pagina,
      filters: {
        id: params.filtros?.id,
        schema_version: params.filtros?.schema_version,
        incluir_inativos: params.filtros?.incluir_inativos,
      },
    });

    logger.info({
      acao: "listagem_respostas",
      id_formulario: formId,
      quantidade: respostas.length,
      usuario: "system",
      timestamp: new Date().toISOString(),
    });
    return respostas;
  }

  async desativarResposta(
    formId: string,
    respostaId: string,
    usuario: string
  ): Promise<void> {
    const resposta = await this.formRepository.findResponseById(
      formId,
      respostaId
    );
    if (!resposta) throw new Error("Resposta não encontrada");
    if (!resposta.is_ativo) throw new Error("Resposta inativa");

    await this.formRepository.softDeleteResponse(formId, respostaId, usuario);

    logger.info({
      acao: "exclusao_logica_resposta",
      id_formulario: formId,
      id_resposta: respostaId,
      usuario,
      timestamp: new Date().toISOString(),
    });
  }

  private async validarCampos(campos: Field[]): Promise<void> {
    for (const campo of campos) {
      await this.fieldValidator.validate(undefined, campo);
    }
  }

  private avaliarCondicional(
    condicional: string,
    valores: Record<string, unknown>
  ): boolean {
    try {
      const [campoId, valorEsperado] = condicional.split("=");
      if (!campoId || !valorEsperado)
        throw new Error("Formato condicional inválido");
      const valor = valores[campoId];
      return valor === valorEsperado;
    } catch (error) {
      throw new Error(`Expressão condicional inválida: ${condicional}`);
    }
  }

  private verificarDependenciasCirculares(campos: Field[]): void {
    const grafo = new Map<string, string[]>();
    campos.forEach((campo) => grafo.set(campo.id, campo.dependencias || []));

    const visitados = new Set<string>();
    const pilhaRecursao = new Set<string>();

    const detectarCiclo = (no: string): void => {
      visitados.add(no);
      pilhaRecursao.add(no);

      for (const vizinho of grafo.get(no) || []) {
        if (!visitados.has(vizinho)) {
          detectarCiclo(vizinho);
        } else if (pilhaRecursao.has(vizinho)) {
          throw new Error(
            `Dependência circular detectada no campo: ${vizinho}`
          );
        }
      }

      pilhaRecursao.delete(no);
    };

    for (const no of grafo.keys()) {
      if (!visitados.has(no)) detectarCiclo(no);
    }
  }
}
