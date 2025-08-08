# Análise Técnica da Plataforma de Formulários Inteligentes

Este documento detalha as tecnologias e a arquitetura adotadas no projeto, destacando como elas atendem aos requisitos de negócio.

## 1. Tecnologias Utilizadas

ps:(A maioria das tecnologias escolhidas foi pela familiaridade e uso anteriores em projetos, com excessão da injeção de dependencias e a ferramenta para o calculo de formulas, que eu tive que aprender)

### Backend (Node.js com TypeScript)

A escolha de Node.js e TypeScript fornece um ambiente de desenvolvimento robusto, tipagem estática e um ecossistema de pacotes maduro, essencial para construir uma aplicação de nível empresarial.

### Framework (Express)

Express.js foi utilizado para a criação da API REST, sendo uma escolha leve e flexível que se integra facilmente com outras bibliotecas.

### Banco de Dados (PostgreSQL)

PostgreSQL é um banco de dados relacional poderoso, confiável e com suporte a JSONB, que é ideal para armazenar a estrutura de campos dinâmicos dos formulários.

### ORM (Prisma)

O Prisma é usado como ORM, simplificando a interação com o banco de dados e permitindo a gestão de schema e migrações de forma segura e estruturada.

### Injeção de Dependências (tsyringe)

O uso de tsyringe promove uma arquitetura modular e desacoplada, facilitando a testabilidade, a manutenção e a extensibilidade do código.

### Validação de Dados (zod)

zod é uma biblioteca de validação de schema que garante a integridade dos dados de entrada, reforçando o requisito de "Confiabilidade Absoluta".

### Cálculos de Fórmulas (mathjs)

Para a engine de cálculo, a biblioteca mathjs foi utilizada para avaliar as expressões matemáticas definidas nos campos do tipo calculated.

### Logs e Auditoria (winston)

winston é a biblioteca de logging escolhida para gerar logs de auditoria detalhados, atendendo diretamente ao requisito de "Auditabilidade Completa".

### Testes (Jest)

Jest foi usado para a suíte de testes unitários e de integração, garantindo a qualidade do código e a conformidade com as regras de negócio.

### Containerização (Docker)

A utilização de Docker e Docker Compose permite empacotar a aplicação com suas dependências, garantindo que ela rode de forma consistente em qualquer ambiente, seja desenvolvimento, teste ou produção.

## 2. Arquitetura e Fluxos

### Arquitetura Modular

A aplicação segue um padrão de arquitetura em camadas, com as responsabilidades bem divididas entre Controller, Service e Repository.

#### FormController

Lida com as requisições HTTP e delega a lógica de negócio para o Service.

#### FormService

Contém a lógica de negócio, como validações, processamento de campos calculados e regras de negócio.

#### FormRepository

Abstrai a camada de acesso a dados, usando o Prisma para interagir com o banco de dados.

### Fluxo da Engine de Cálculo

1. **Validação da Estrutura**  
   Quando um formulário é criado, a engine de cálculo (`Calculator.ts`) e o `Graph.ts` analisam os campos para garantir que não haja dependências circulares.

2. **Identificação de Dependências**  
   O Graph cria um grafo de dependências, onde:

   - Nós são os IDs dos campos
   - Arestas representam a relação de dependência

3. **Ordenação Topológica**  
   Um algoritmo de ordenação topológica é aplicado ao grafo para determinar a ordem correta de execução dos campos calculados, garantindo que o valor de um campo só seja calculado após todos os seus campos dependentes estarem disponíveis.

4. **Cálculo e Atribuição**  
   Durante a submissão de respostas, o FormService:
   - Itera sobre os campos calculados na ordem correta
   - Avalia as fórmulas com mathjs
   - Atribui os resultados

## 3. Dificuldades Encontradas

### Execução do codigo

Encontrei alguns problemas para a execução do codigo para os testes e em uma proxima vez eu mudaria a ordem no qual o projeto foi feito para uma abordagem test first, assim eu teria mais dominio de cada endpoint criado em tempo real e assim o projeto sairia melhor

### Implementação do Fluxo de Criação de Formulários

Encontrei desafios significativos na implementação do fluxo de criação de formulários, principalmente:

- **Complexidade na validação de dependências circulares** entre campos calculados
- **Dificuldade em manter a consistência** do estado do formulário durante edições simultâneas
- **Desafios na serialização/desserialização** da estrutura complexa de formulários

### Documentação com Swagger

A criação da documentação Swagger apresentou problemas como:

- **Integração complexa** com a arquitetura modular existente
- **Dificuldade em documentar** adequadamente os endpoints com parâmetros dinâmicos
- **Manutenção da documentação** sincronizada com as mudanças no código

## 4. Melhorias Futuras

### Prioridade em Segurança

- Implementar **validação individual por campo** com regras específicas
- Adicionar **camada de criptografia** para dados sensíveis nos formulários
- Melhorar **controle de acesso** com RBAC (Role-Based Access Control)
- Implementar **rate limiting** para prevenção de abuso

### Melhorias na Validação

- Criar **sistema de validação em tempo real** para campos do formulário
- Implementar **validação contextual** que considere outros campos do formulário
- Adicionar **suporte a expressões regulares complexas** para validação

### Outras Melhorias

- Desenvolver **UI mais intuitiva** para criação de fórmulas calculadas
- Implementar **sistema de versionamento** de formulários
- Adicionar **suporte a internacionalização** nos formulários
- Melhorar **performance** no processamento de formulários complexos

## 5. Conclusão

A plataforma atual atende aos requisitos básicos, mas as melhorias propostas, especialmente na área de segurança e validação individual de campos, trarão maior robustez e usabilidade ao sistema, posicionando-o como uma solução completa para formulários inteligentes em ambientes empresariais.
