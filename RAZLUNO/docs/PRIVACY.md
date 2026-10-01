# Privacidade e GDPR

## Já implementado (Fase 1)
- Senha guardada só como hash forte (PBKDF2 + sal + segredo do servidor).
- IP nunca guardado puro: só um hash com segredo (`IP_HASH_SECRET`).
- Sessões revogáveis: sair, desconectar aparelho, trocar senha e recuperar senha derrubam os acessos certos.
- Consentimento de termos e privacidade gravado com a **versão** do documento e a data (`consents`).
- Auditoria de cadastro, login, falha de login, troca de senha e desconexão (`audit_logs`).
- Dados de pagamento e banco do professor **não** ficam no Razluno: só a referência da conta no provedor.

## Planejado (Fase 7)
- Exportar meus dados (JSON) e excluir conta (anonimiza o que a lei manda manter, como registros fiscais).
- Consentimento específico para gravação de aula, pedido antes de entrar na sala; retenção das gravações por `recording.retention_days` (365, configurável), depois exclusão automática.
- Gravações só para quem estava inscrito na turma e para o professor; nunca públicas.
- Aviso e aceite para cursos com risco físico (`courses.is_hazardous`).

## Pendente antes do lançamento
- Texto jurídico dos **Termos de uso** e da **Política de privacidade** (as páginas existem e avisam que estão em preparação).
- Definir o responsável pelo tratamento (empresa europeia ou representante na UE) e o contato de privacidade.
- O certificado não pode afirmar reconhecimento profissional ou governamental sem comprovação.
