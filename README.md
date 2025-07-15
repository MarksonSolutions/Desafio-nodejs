# API Gateway de Mensageria - Node.js, Baileys e RabbitMQ

Este projeto implementa um gateway de mensagens assíncronas, integrando Node.js, Express, RabbitMQ e Baileys (WhatsApp). A API permite o envio e recebimento de mensagens via filas, além de monitoramento e controle das filas e do status do WhatsApp.

---

## Como rodar com Docker

### Pré-requisitos
- Docker
- Docker Compose

### Passos rápidos

```bash
git clone <repo-url>
cd projeto-baileys
docker-compose up -d
```

- Acesse a API: http://localhost:3000
- Gerencie filas: http://localhost:15672 (RabbitMQ, user: guest, senha: guest)

Para logs em tempo real:
```bash
docker-compose logs -f app
```

Para parar:
```bash
docker-compose down
```

---

## Rodando localmente (sem Docker)

- Node.js 16+ (recomendado 20+)
- RabbitMQ rodando localmente

```bash
npm install
cp env.example .env
npm run dev
```

---

## Variáveis de ambiente principais (`.env`)

```
PORT=3000
NODE_ENV=development
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_VHOST=/
LOG_LEVEL=info
LOG_FORMAT=json
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
BAILEYS_SESSION_PATH=./sessions
JWT_SECRET=algum-segredo
```

---

## Endpoints principais

### Mensagens
- `POST   /api/messages/send` — Envia mensagem para uma fila
- `GET    /api/messages/receive/:queueName` — Consome mensagens de uma fila
- `GET    /api/messages/:messageId/status` — Status de uma mensagem
- `DELETE /api/messages/:messageId` — Remove mensagem

### Filas
- `GET    /api/queues/status` — Status de todas as filas
- `GET    /api/queues/:queueName/status` — Status de uma fila
- `POST   /api/queues/:queueName` — Cria fila
- `DELETE /api/queues/:queueName` — Remove fila
- `POST   /api/queues/:queueName/purge` — Limpa fila
- `GET    /api/queues/:queueName/messages` — Mensagens da fila

### WhatsApp
- `GET    /api/whatsapp/status` — Status da conexão WhatsApp
- `GET    /api/whatsapp/qr` — QR code para autenticação
- `GET    /api/whatsapp/queues` — Filas relacionadas ao WhatsApp

### Health
- `GET    /health` — Health check
- `GET    /api/health` — Health check

---

## Exemplos de uso

**Enviar mensagem:**
```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "queue": "pedidos",
    "message": {
      "id": "pedido_001",
      "content": "Novo pedido criado",
      "timestamp": "2024-01-15T10:30:00Z",
      "metadata": {
        "sender": "api_pedidos",
        "priority": "high"
      }
    }
  }'
```

**Receber mensagens:**
```bash
curl -X GET "http://localhost:3000/api/messages/receive/pedidos?limit=5&timeout=10"
```

**Status das filas:**
```bash
curl -X GET http://localhost:3000/api/queues/status
```

**Status do WhatsApp:**
```bash
curl -X GET http://localhost:3000/api/whatsapp/status
```

**Obter QR code do WhatsApp:**
```bash
curl -X GET http://localhost:3000/api/whatsapp/qr
```

---

## Testes

- Testes unitários e integração em `/tests`
- Para rodar:
```bash
npm test
```

---

## Observações
- O status do WhatsApp pode aparecer como `PENDING` até que o QR code seja escaneado.
- O endpoint de status de mensagem retorna um placeholder, pronto para extensão.
- O sistema cria filas automaticamente ao enviar mensagens para uma fila inexistente.
- O logger exibe o QR code no console quando gerado.

---

## Checklist de entrega
- [x] Código fonte organizado
- [x] Endpoints conforme especificação
- [x] Testes implementados
- [x] Documentação clara
- [x] Tratamento de erros
- [x] Logging estruturado
- [x] Variáveis de ambiente
- [x] Pronto para Docker

---

Dúvidas? Abra uma issue ou entre em contato.
