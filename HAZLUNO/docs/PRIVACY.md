# Privacidade e GDPR

## Já implementado (Fase 1)
- Senha guardada só como hash forte (PBKDF2 + sal + segredo do servidor).
- IP nunca guardado puro: só um hash com segredo (`IP_HASH_SECRET`).
- Sessões revogáveis: sair, desconectar aparelho, trocar senha e recuperar senha derrubam os acessos certos.
- Consentimento de termos e privacidade gravado com a **versão** do documento e a data (`consents`).
- Auditoria de cadastro, login, falha de login, troca de senha e desconexão (`audit_logs`).
- Dados de pagamento e banco do professor **não** ficam no Hazluno: só a referência da conta no provedor.

## Planejado (Fase 7)
- Exportar meus dados (JSON) e excluir conta (anonimiza o que a lei manda manter, como registros fiscais).
- Consentimento específico para gravação de aula, pedido antes de entrar na sala; retenção das gravações por `recording.retention_days` (365, configurável), depois exclusão automática.
- Gravações só para quem estava inscrito na turma e para o professor; nunca públicas.
- Aviso e aceite para cursos com risco físico (`courses.is_hazardous`).

## Pendente antes do lançamento
- Texto jurídico dos **Termos de uso** e da **Política de privacidade** (as páginas existem e avisam que estão em preparação).
- Definir o responsável pelo tratamento (empresa europeia ou representante na UE) e o contato de privacidade.
- O certificado não pode afirmar reconhecimento profissional ou governamental sem comprovação.

## Verificação facial na sala ao vivo (pedido do dono — Fase 4)
Objetivo: comprovar que quem entra na aula é o aluno inscrito e que quem dá a aula é o professor verificado.
- **Professor:** verificação de identidade com documento + selfie no cadastro (verificação de professor) e checagem facial com prova de vida ao abrir cada encontro. Se não bater, a aula não começa.
- **Aluno:** checagem facial com prova de vida ao entrar em cada encontro, comparada com a selfie feita na primeira inscrição. Câmera ligada durante a aula, com nova checagem em intervalos.
- **Provedor certificado** (ex.: Onfido, Veriff, iProov) pela mesma camada de abstração dos outros serviços. O Hazluno não guarda fotos do rosto nem o "molde" facial: guarda só o resultado (aprovado/recusado, data, provedor).
- **GDPR:** dado biométrico é dado sensível (art. 9). Exige consentimento explícito e separado, avaliação de impacto (DPIA), prazo de retenção curto e alternativa para quem não puder usar biometria (ex.: verificação por documento com atendimento humano).
- **Limite honesto:** a checagem garante quem está na frente da câmera. Nenhum sistema consegue impedir que alguém fora da câmera, na mesma sala, ouça a aula. Dá para dificultar (só uma conexão por inscrição, sem compartilhar link, aviso nos termos, marca-d'água com o nome do aluno no vídeo), mas não para garantir 100%.
