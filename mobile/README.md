# Whaticket Mobile

App Expo enxuto para o Whaticket, sem a seção de fluxos.

## Escopo inicial

- login
- lista de tickets
- abas `Atendendo`, `Aguardando`, `Resolvidos` e `Todas`
- visualização de mensagens
- envio de mensagem de texto
- aceitar, reabrir e resolver ticket

## Rodar

```bash
cd /home/ubuntu/whaticket/mobile
npm install
npx expo start --tunnel
```

Opcionalmente, sobrescreva a API:

```bash
EXPO_PUBLIC_API_URL=https://api-whaticket.digiyou.com.br npx expo start --tunnel
```
