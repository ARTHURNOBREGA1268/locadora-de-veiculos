# Locadora de veículos — progresso e pendências

## Precificação de locações — implementado

### Custos, margem e tarifa base
- [x] Cálculo da diária mínima com depreciação `(compra − revenda) ÷ (vida útil em meses × 30)`, capital mensal ÷ 30, tributos anuais ÷ 365, estrutura rateada, manutenção/pneus por km e limpeza por locação.
- [x] Custos incompletos ficam marcados como pendentes; não são inventados nem tratados como zero. Comissão e taxas de pagamento são consideradas no preço mínimo.
- [x] Entradas de custo e preço são validadas contra a faixa e precisão dos tipos DECIMAL do MySQL antes da gravação.
- [x] Custos operacionais gerais e por veículo editáveis por ADMIN; a tela apresenta recomendação calculada no backend, considerando margem mínima e piso por categoria.
- [x] Tarifas por categoria com valores diários/semanal/mensal, início/fim de vigência e status ativo; vigências ativas sobrepostas são rejeitadas.
- [x] Pacotes semanais/mensais tratados como totais de sete/trinta diárias; o motor compara composições e seleciona a menor elegível.
- [x] Piso por categoria, custo mínimo e margem mínima protegidos no cálculo; publicação de tarifa ou pacote abaixo do piso é recusada. Sem fallback silencioso para `Veiculo.valorDiaria`.

### Ajustes dinâmicos
- [x] CRUD de regras por categoria/todas, sazonalidade, dia da semana, antecedência, ocupação e duração.
- [x] Regras aplicadas no backend por prioridade, com percentuais sequenciais e valores fixos por diária. Regra não acumulável não é combinada com outra regra dinâmica elegível.
- [x] Validação de datas, limites, dias da semana, percentuais negativos e piso após ajustes.

### Adicionais, proteções, promoções e histórico
- [x] Configuração de combustível (taxa fixa/litro), limpeza, aeroporto, outra filial, entrega fixa/por km, km excedente, atraso, cancelamento, multas, ISS, cartão e parcelamento.
- [x] CRUD de adicionais por diária ou locação com teto máximo; preço de proteção por categoria ou global; caução permanece separada do total.
- [x] CRUD de cupons com vigência, escopo de categoria/convênio, desconto percentual/fixo e limite total/por cliente; uso é contabilizado atomicamente na confirmação.
- [x] Nível de fidelidade derivado de locações finalizadas. Cupom/fidelidade reduzem somente diárias, limitados ao excedente acima do piso; cotação sinaliza quando limita desconto. Impostos são calculados após descontos.
- [x] Auditoria administrativa por campo, valor anterior/novo e usuário; snapshot `LocacaoPreco` conserva composição, regras, promoção e caução sem recalcular locações históricas.
- [x] Cadastros referenciados são inativados em vez de excluídos fisicamente.

### API e interface de precificação
- [x] Cotação/opções autenticadas; gestão restrita a ADMIN; o navegador envia escolhas, nunca totais confiáveis.
- [x] Página `/precificacao` com recomendações, custos, tarifas, pisos, regras, adicionais, proteções, cupons, fidelidade, busca e filtro por status.
- [x] Formulário de locação integrado a cotação, adicionais/proteções, cupom, convênio, taxas opcionais e discriminação; caução aparece separada.

## Atualização do módulo de locações — especificação do anexo, pendente

### Identificação, cliente e período
- [x] `codigo VARCHAR(20) UNIQUE` (ex.: `LOC-2026-0001`), gerado no backend e somente leitura.
- [x] `cliente_id INT FK → clientes`: autocomplete por nome/CPF; Cliente é entidade separada de Usuario, com vínculo opcional único a uma conta USER. CPF único opcional para compatibilidade com cadastros antigos sem CPF. O vínculo de conta só pode ser alterado antes da primeira locação, evitando transferir acesso ao histórico.
- [x] `veiculo_id INT FK → veiculos`: selecionar somente veículo disponível durante todo o período solicitado; `categoria_id INT FK → categorias` congela a categoria reservada nas novas locações. Registros legados sem snapshot preservam `categoria_id = NULL`.
- [x] `status ENUM(reservada, retirada, em_andamento, devolvida, finalizada, cancelada)` como badge; `origem ENUM(balcao, site, telefone, app, convenio)` como select; `atendente_id INT FK → usuarios` somente leitura.
- [x] `retirada_prevista DATETIME` e `devolucao_prevista DATETIME` em datetime picker; `retirada_real DATETIME NULL` e `devolucao_real DATETIME NULL` somente leitura, preenchidas pelo fluxo/vistoria.
- [x] `qtd_diarias_previstas SMALLINT` e `qtd_diarias_cobradas SMALLINT NULL` calculadas e somente leitura.

### Retirada, devolução, quilometragem e combustível
- [x] `filial_retirada_id INT FK → filiais` e `filial_devolucao_id INT FK → filiais` em selects, validados pelas regras de filial.
- [x] `entrega_domicilio BOOLEAN` em switch; `endereco_entrega VARCHAR(255) NULL` habilitado se entrega; `endereco_coleta VARCHAR(255) NULL`; `distancia_entrega_km DECIMAL(6,2) NULL`; `voo_numero VARCHAR(10) NULL` para retirada em aeroporto.
- [x] `km_saida INT NULL`, `km_entrada INT NULL`, `km_franquia_total INT NULL` calculado e `km_excedente INT NULL` calculado, com limites e consistência do hodômetro.
- [x] `combustivel_saida TINYINT NULL` e `combustivel_entrada TINYINT NULL`, ambos limitados a 0–100; campos reais são preenchidos por vistoria, não por edição livre na reserva.

### Motoristas, valores e itens vinculados
- [x] `locacao_motoristas(id, locacao_id FK, cliente_id FK, principal BOOLEAN)` com lista e botão adicionar; validar motorista principal e limites da configuração.
- [x] Resumo somente leitura de `valor_diaria_aplicada DECIMAL(10,2)`, `subtotal DECIMAL(12,2)`, `desconto_total DECIMAL(12,2)`, `valor_total DECIMAL(12,2)` destacado e `valor_final_cobrado DECIMAL(12,2) NULL` após fechamento; `promocao_id INT FK NULL` por cupom. Preservar o snapshot de preço existente.
- [x] `locacao_adicionais(locacao_id FK, adicional_id FK, quantidade SMALLINT, valor_unitario DECIMAL(10,2), valor_total DECIMAL(10,2))` com seleção e quantidade; valores congelados da cotação.
- [x] `locacao_protecoes(locacao_id FK, protecao_id FK, valor_diaria DECIMAL(10,2), valor_total DECIMAL(10,2))` com seleção e valores congelados.
- [x] `locacao_cobrancas_extras(locacao_id FK, tipo ENUM(km_excedente, combustivel, limpeza, atraso, avaria, multa_transito, outros), descricao VARCHAR(120), valor DECIMAL(10,2))` exibidas em tabela; cobranças automáticas limitadas a ocorrências registradas/calculadas.
- [x] Modal ADMIN para registrar ocorrências avulsas (avaria/multa/outros) com tipo, descrição e valor validado; cria saldo pendente, preserva o registro e só permite inclusão após devolução e antes de finalizar.

### Pagamento, caução e cancelamento
- [x] `caucao_valor DECIMAL(10,2)` somente leitura e `caucao_status ENUM(pendente, retida, liberada, utilizada)` apresentado como badge. Sem gateway, nenhuma captura ou liquidação é simulada.
- [x] `forma_pagamento ENUM(credito, debito, pix, boleto, dinheiro, faturado)` em select; `parcelas TINYINT` em input, validado pela configuração.
- [x] `locacao_pagamentos(id, locacao_id FK, tipo ENUM(reserva, caucao, saldo, estorno), valor DECIMAL(10,2), status ENUM(pendente, pago, falhou, estornado), gateway_id VARCHAR(80) NULL, pago_em DATETIME NULL)` em tabela somente leitura. Sem gateway existente, não simular pagamentos/capturas; registros começam pendentes.
- [x] `cancelada_em DATETIME NULL` e `motivo_cancelamento VARCHAR(255) NULL` somente leitura/textarea no cancelamento; `multa_cancelamento DECIMAL(10,2) NULL` calculada e persistida no servidor. O serviço HTTP envia o motivo à API.

### Vistorias, contrato e histórico
- [x] `vistoria_saida_id INT FK → vistorias NULL` e `vistoria_entrada_id INT FK → vistorias NULL`; modal coleta hodômetro/combustível/observações e grava a vistoria vinculada à locação.
- [x] Exibir os `checklist_itens` ativos no modal, exigir resposta dos obrigatórios e persistir um snapshot JSON das respostas/descrições na vistoria de saída/entrada; itens removidos da configuração são inativados.
- [x] `contrato_texto LONGTEXT` é congelado com o modelo vigente no momento da locação, pode ser visualizado e impresso sem substituir o snapshot.
- [x] `contrato_assinado BOOLEAN` em switch ADMIN e `contrato_assinado_em DATETIME NULL` imutável após marcar; só registra assinatura física, sem assinatura digital automática.
- [x] `observacoes TEXT NULL` em textarea, com comprimento e acesso validados.
- [x] `locacao_status_historico(locacao_id INT FK, status_anterior VARCHAR(20), status_novo VARCHAR(20), usuario_id INT FK, alterado_em DATETIME)` somente leitura em timeline; gravar cada transição na mesma transação.
- [x] Todas as tabelas novas têm `id INT AUTO_INCREMENT PK`, `created_at DATETIME` e `updated_at DATETIME`, quando aplicável.

### Regras de migração, segurança e fluxo
- [x] Migration incremental e backfill preservando reservas existentes: cria Clientes vinculados às contas anteriores, mapeia locações sem inventar CPF, categoria congelada, filial, origem, valores ou eventos operacionais; esses campos históricos permanecem `NULL` quando não têm fonte. Mantém FKs e histórico sem exclusões físicas. Migration e cenário integral passaram no CI com MySQL real.
- [x] USER lista, visualiza e opera somente reservas do Cliente associado à própria conta; ADMIN consulta lista global, clientes, cobranças e campos administrativos. Totais e caução são visíveis somente ao próprio titular e a ADMIN.
- [x] Manter fluxo automático `reservada → retirada → em_andamento → devolvida → finalizada`, cancelamento apenas antes da retirada; não permitir alteração manual livre de status.
- [x] UI transforma o histórico de cartões em tabela responsiva com detalhe por seção, busca/status e ações correspondentes ao estado; campos calculados/readonly não podem ser forjados pelo frontend.

## Pendências já identificadas da precificação
- [x] Cobrança operacional de km excedente, atraso e combustível calculada após registrar a vistoria de devolução, quando a configuração e dados de operação permitem.
- [ ] Integrar taxa administrativa de multa de trânsito ao fluxo de multas, quando a infração vinculada à locação estiver registrada.
