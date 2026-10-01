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

## Tela de pagamento (referência `brand/payment-reference-phase3.webp`)
Resumo do curso, resumo da reserva, escolha do método e "Confirmar y reservar mi plaza". Ajustes obrigatórios:
- **Vaga segurada por 15 minutos** (`enrollment.seat_hold_minutes`) a partir do "Continuar", com contador na tela. Passou o tempo sem pagamento confirmado, a vaga volta.
- **Resumo completo:** todos os encontros (datas no fuso de quem vê), preço **por grupo** e total.
- **Antes do botão:** caixa de aceite da regra de desistência ("si cancelas, pierdes el 50 %") e, em curso com risco, do aviso de segurança. Sem aceite, o botão fica desativado.
- **Cartão:** os dados são digitados no componente do provedor, nunca no app.
- **PayPal:** possível pelo próprio provedor (Stripe oferece na Europa).
- **Transferência bancária: não recomendo.** Demora de 1 a 3 dias para confirmar, e a vaga não pode ficar presa esse tempo, nem a aula começar sem o pagamento confirmado. Para a Espanha, o método rápido mais usado é o **Bizum** (exige um provedor que o aceite, como Redsys); na Holanda, iDEAL; na Bélgica, Bancontact. A lista de métodos sai do provedor escolhido.
- "Tu pago es seguro" só aparece com o provedor real ligado.

## Tela "¡Tu plaza está confirmada!" (referência `brand/confirmation-reference-phase3.webp`)
Só aparece depois que o provedor confirmou o pagamento (webhook), nunca ao clicar em pagar. Ajustes obrigatórios:
- **Sem link da aula por e-mail.** Link pode ser repassado e outra pessoa entraria no lugar do aluno. O e-mail leva só a confirmação e o recibo; a entrada é **somente pelo app** ("Mis clases" → "Entrar"), com a verificação facial.
- Trocar "Recibirás el enlace unos minutos antes" por "Entrarás desde la app, en Mis clases, con verificación facial".
- O selo do cartão mostra "Inicia el miércoles 15 · 09:00" (não "EN VIVO", que é só para aula acontecendo agora).
- No lugar de "18 plazas disponibles": "Tu plaza: confirmada".
- "Agregar al calendario": arquivo .ics com **todos** os encontros da turma.
- Final do cartão (•••• 4582) vem do provedor; o Hazluno não guarda o cartão.
- Lembrete discreto da regra de desistência e link para o recibo.
- "Te hemos enviado los detalles a tu correo" só aparece se o e-mail realmente foi enviado.
