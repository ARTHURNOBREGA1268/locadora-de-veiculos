# Precificação de locações — status

## Implementado

### Custos, margem e tarifa base
- [x] Cálculo da diária mínima com depreciação `(compra − revenda) ÷ (vida útil em meses × 30)`, capital mensal ÷ 30, tributos anuais ÷ 365, estrutura rateada, manutenção/pneus por km e limpeza por locação.
- [x] Custos incompletos ficam marcados como pendentes; não são inventados nem tratados como zero. Comissão e taxas de pagamento são consideradas no preço mínimo.
- [x] Entradas de custo e preço são validadas contra a faixa e precisão dos tipos DECIMAL do MySQL antes da gravação.
- [x] Custos operacionais gerais e por veículo editáveis por ADMIN; a tela apresenta a recomendação calculada no backend, já considerando margem mínima e piso por categoria.
- [x] Tarifas `categoria_id`, diárias/semanal/mensal, início/fim de vigência e status ativo; vigências ativas sobrepostas são rejeitadas.
- [x] Pacotes semanais/mensais tratados como totais de sete/trinta diárias; o motor compara composições e seleciona a menor elegível.
- [x] Piso de preço por categoria, custo mínimo e margem mínima protegidos no cálculo; publicação de tarifa diária ou pacote ativo abaixo do piso é recusada. Não existe fallback silencioso para `Veiculo.valorDiaria`.

### Ajustes dinâmicos
- [x] CRUD de regras por categoria/todas as categorias, sazonalidade, dia da semana, antecedência, ocupação e duração.
- [x] Aplicação no backend por prioridade, com ajustes percentuais sequenciais e valores fixos por diária. Regra não acumulável não é combinada com outras regras dinâmicas elegíveis.
- [x] Validação de datas, limites, dias da semana, percentuais negativos e piso após ajustes.

### Adicionais, proteções e taxas
- [x] Configuração de taxas de combustível (fixa/litro), limpeza, aeroporto, outra filial, entrega fixa/por km, km excedente, atraso, cancelamento, multas, ISS, cartão e parcelamento.
- [x] CRUD de adicionais por diária ou por locação, com teto máximo opcional.
- [x] Preço de proteções por categoria ou global e seleção no formulário. Caução permanece separada do total e seu valor é preservado no snapshot.
- [x] Cotação oferece serviços adicionais, mostra seus preços e recalcula a discriminação no backend; controles numéricos são validados antes do cálculo.

### Promoções, fidelidade, histórico e snapshot
- [x] CRUD de cupons com vigência, escopo de categoria/convênio, desconto percentual/fixo e limites total/por cliente; contador de usos é somente leitura.
- [x] Uso de cupom é contabilizado atomicamente na confirmação. Nível de fidelidade deriva de locações finalizadas; cupom/fidelidade só reduzem diárias, limitados ao excedente acima do piso, e a cotação sinaliza quando limita desconto. Impostos são calculados após os descontos.
- [x] Auditoria de alterações de preço por campo, valor anterior/novo e ADMIN responsável.
- [x] Snapshot `LocacaoPreco` armazena diária, quantidade, subtotais, adicionais, proteções, desconto, taxas/impostos, caução, regras e promoção; `Locacao.valorTotal` coincide com o preço congelado. Consultas históricas não recalculam tarifas.
- [x] Registros financeiros e catálogos são inativados em vez de fisicamente removidos.

### API e interface
- [x] Endpoints de cotação/opções autenticados; CRUD administrativo e painel restritos a ADMIN. O navegador envia escolhas, não totais.
- [x] Página `/precificacao` com custos recomendados, tarifas, pisos, regras, adicionais, proteções, cupons, fidelidade, busca, filtro por status e histórico.
- [x] Formulário de locação integrado com cotação automática, cupom, convênio, opcionais/proteções, taxas selecionáveis, estimativa discriminada e caução separada.

## Pendências
- [ ] Integrar a cobrança operacional final de km excedente, atraso e taxa administrativa de multa aos fluxos de devolução/multa, quando quilometragem, horário e ocorrência forem registrados. Até essa integração, essas tarifas são configuráveis, mas não são cobradas automaticamente.
- [ ] Validar o cenário MySQL integral no workflow GitHub após a publicação; os testes locais do ambiente atual executam unit/HTTP e deixam a integração MySQL opt-in quando não há servidor disponível.
