/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Field {
  id: string;
  label: string;
  tipo: "text" | "number" | "boolean" | "select" | "date" | "calculated";
  obrigatorio?: boolean;
  condicional?: string;
  validacoes?: Array<{ tipo: string; valor?: any; mensagem?: string }>;
  formula?: string;
  dependencias?: string[];
  precisao?: number;
  formato?: "inteiro" | "decimal";
  multipla?: boolean;
  opcoes?: Array<{ label: string; value: string }>;
  minima?: string;
  maxima?: string;
}

export interface Form {
  id: string;
  nome: string;
  descricao?: string;
  schema_version: number;
  is_ativo: boolean;
  data_criacao: Date;
  data_remocao?: Date;
  usuario_remocao?: string;
  protegido: boolean;
  campos: Field[];
}

export interface Response {
  id: string;
  formId: string;
  schema_version: number;
  respostas: Record<string, any>;
  calculados: Record<string, any>;
  criado_em: Date;
  is_ativo: boolean;
  data_remocao?: Date;
  usuario_remocao?: string;
}
