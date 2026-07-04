# Helper de autenticação do navegador para Baileys

Este projeto auxilia contas que conseguem concluir a autenticação oficial por passkey no WhatsApp Web, mas não conseguem finalizar um novo vínculo diretamente pelo QR ou código de pareamento do Baileys.

Ele usa a ponte proposta no PR #2676:

- Issue: https://github.com/WhiskeySockets/Baileys/issues/2672
- PR em rascunho: https://github.com/WhiskeySockets/Baileys/pull/2676

O script **não burla a passkey**. O próprio usuário conclui o vínculo e a confirmação no WhatsApp Web oficial; depois, a sessão autenticada é convertida para o formato multi-file do Baileys.

## Aviso de segurança

Estas pastas contêm uma sessão ativa e nunca devem ser compartilhadas:

- `baileys_auth_imported/`
- `wa_web_bridge_profile/`

Caso sejam expostas, remova imediatamente o dispositivo vinculado pelo aplicativo do WhatsApp.

## Requisitos

- Node.js 20 ou superior
- Chrome, Microsoft Edge ou Chromium
- Conta capaz de concluir o fluxo oficial de passkey no WhatsApp Web

## Instalação

```bash
npm install
```

## Extração

```bash
npm run import
```

No navegador:

1. Faça o vínculo pelo WhatsApp Web oficial.
2. Conclua a confirmação por passkey.
3. Aguarde a lista de conversas aparecer.
4. Volte ao terminal e pressione ENTER.

O resultado será salvo em:

```text
baileys_auth_imported/
```

## Verificação

```bash
npm run verify
```

Resultado esperado:

```text
✅ Imported auth is usable: connection=open
```

## Observação sobre `registered: false`

Uma sessão importada pode estar completa e funcional mesmo com:

```js
creds.registered === false
```

Não altere esse campo manualmente. Aplicações que validam a sessão antes de iniciar devem verificar a presença do material criptográfico completo, conforme o exemplo do `README.md`.

## Limitação conhecida

Algumas contas continuam recebendo erro `428` mesmo após uma extração válida. Esse comportamento parece pertencer a uma modalidade mais agressiva de exigência de passkey por conexão e não é resolvido por este helper.
