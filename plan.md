# Plano: precificação de locações

## Objetivo
Implementar um módulo de precificação API-first, com cálculo autoritativo no backend, administração restrita a ADMIN e snapshot imutável na confirmação da locação. O dashboard React permanece cliente da API existente; reutiliza a navegação, formulários, validações e padrões visuais já usados nas páginas administrativas.

## Arquitetura e pastas
- `backend/prisma/schema.prisma` e `backend/prisma/migrations/`: tabelas de tarifas, custos operacionais, regras, adicionais, proteções, promoções, fidelidade, histórico e preço congelado.
- `backend/src/services/precificacao.service.js`: validações, CRUD administrativo, cálculo determinístico e composição do preço.
- `backend/src/controllers/`, `backend/src/routes/`, `backend/src/app.js`: endpoints REST com autorização ADMIN para gestão; cotação/confirmação calcula sempre no backend.
- `backend/src/services/locacao.service.js`: cria locação e snapshot do preço atomicamente; mantém `Locacao.valorTotal` igual a `locacao_precos.valor_total`.
- `frontend/src/pages/Precificacao.jsx` e `frontend/src/services/precificacaoService.js`: administração e consulta de cotações pela API, sem cálculos monetários autoritativos no navegador.
- `backend/test/`: validações, cálculo, autorização, transações, concorrência e integração MySQL.

## Regras confirmadas
1. A fórmula de custos gera o mínimo diário recomendado. A tarifa base por categoria é o preço publicado e não pode ficar abaixo do maior entre esse mínimo e o piso configurado.
2. Tarifas semanais e mensais são totais por pacotes de 7 e 30 diárias; o motor compara composições possíveis e escolhe a menor válida.
3. Regras dinâmicas são processadas por prioridade crescente; percentuais aplicam-se sequencialmente e ajustes fixos são por diária. Regra não acumulável não se soma a outra regra dinâmica elegível.
4. Cupom e fidelidade reduzem somente o subtotal das diárias, limitados ao excedente acima do custo mínimo e do piso configurado; a API indica quando limita um desconto. Adicionais, proteções e caução ficam separados; impostos/taxas são calculados após os descontos. Caução não integra o total, mas seu valor vigente é congelado no snapshot da locação.
5. O limite de uso de cupom por cliente requer registro individual de uso ligado a cliente/locação além do contador total. Dados operacionais de custos inexistentes serão configuráveis e não serão preenchidos com valores fictícios.

## Fórmula de referência
- Depreciação diária: `(valor de compra − valor de revenda estimado) / (vida útil em meses × 30)`.
- Custos fixos mensais: capital/financiamento + IPVA + seguro + licenciamento + estrutura administrativa rateada.
- Custos variáveis mensais: custo de manutenção por km × km médio diário × 30 + limpeza por locação × 30 / dias médios da locação.
- Custo por diária efetivamente alugada: `(custo fixo mensal + custo variável mensal) / (30 × ocupação alvo)`.
- Preço mínimo diário recomendado: `custo por diária alugada / (1 − margem desejada)`; depois aplicam-se fatores tarifários elegíveis.
- Valores monetários permanecem em `DECIMAL`; a API arredonda para centavos segundo política única e valida totais antes de persistir.

## Fluxo
1. ADMIN mantém custos por veículo/parâmetros gerais, tarifas por categoria e vigência, regras dinâmicas e demais tabelas de preço.
2. Cotação recebe veículo, período, opcionais/proteções e cupom; backend valida disponibilidade, calcula composição e devolve detalhamento.
3. Confirmação recalcula as condições vigentes, valida limites de promoção e grava locação, valor total e snapshot em uma transação.
4. Histórico de locação lê exclusivamente o snapshot salvo; alterações futuras em tarifas/regras não mudam preços confirmados.

## Compatibilidade
Não usar `Veiculo.valorDiaria` silenciosamente como fallback. Tarifas legadas devem ser convertidas por migração explícita ou configuradas no cadastro de tarifa base. Uma tarifa ausente ou ambígua gera erro claro, nunca preço zero ou seleção arbitrária.
