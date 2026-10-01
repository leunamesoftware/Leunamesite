# Pagamentos (Fase 3 — planejado, ainda não ligado)

## Modelo definido pelo dono
- O professor define o preço de cada turma.
- O professor paga **€5 por turma aberta** (`fee_rules.kind = class_opening_fee`). A turma só abre inscrições depois dessa taxa confirmada pelo provedor.
- O aluno paga a turma ao se inscrever. Comissão sobre a inscrição começa em **0%** (`enrollment_commission`), configurável em percentual, valor fixo ou os dois.
- **Desistência do aluno:** retém 50% do valor pago (`withdrawal.retention_bp = 5000`), dividido 50/50 entre Hazluno e professor (`withdrawal.retention_platform_share_bp = 5000`). O aluno vê essa regra e aceita (`consents.kind = withdrawal_policy`) antes de pagar.
- Cancelamento pelo professor ou pela plataforma: reembolso integral.

## Regras técnicas
- Provedor de marketplace com contas conectadas para repassar ao professor (ex.: Stripe Connect; Mollie e Adyen também servem na Europa). A escolha é do dono.
- Começa **obrigatoriamente** em sandbox (`payments.is_test = 1`).
- O app nunca recebe dados de cartão: o pagamento acontece na página/componente do provedor.
- Só o **webhook verificado** marca um pagamento como `succeeded`; cada evento é gravado uma vez (`payment_transactions.provider_event_id` único).
- A divisão de cada pagamento fica em `platform_fees` (bruto = taxa do provedor + comissão + líquido do professor, conferido pelo banco).
- Repasses ao professor em `instructor_payouts`, feitos pelo provedor.

## O que o dono precisa decidir/criar
1. Qual provedor (sugestão: Stripe Connect, por ter a melhor documentação e sandbox).
2. Conta da empresa no provedor e chaves de teste.
3. Revisão jurídica da regra de desistência para os países de lançamento (direito do consumidor da UE).
