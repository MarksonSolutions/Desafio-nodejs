# Integração Baileys + RabbitMQ

## Visão Geral

Esta API funciona como um **gateway de mensagens** que integra o WhatsApp (via Baileys) com RabbitMQ, permitindo:

1. **Receber mensagens do WhatsApp** e enviá-las para filas RabbitMQ
2. **Enviar mensagens WhatsApp** via API REST
3. **Gerenciar filas RabbitMQ** para processamento assíncrono
4. **Monitorar eventos do WhatsApp** em tempo real

## Arquitetura

```
WhatsApp ←→ Baileys ←→ API Gateway ←→ RabbitMQ ←→ Consumidores
```

### Fluxo de Dados

1. **Mensagens Recebidas**: WhatsApp → Baileys → Fila `whatsapp.messages.incoming`
2. **Mensagens Enviadas**: API → Baileys → WhatsApp → Fila `whatsapp.messages.outgoing`
3. **Atualizações**: WhatsApp → Baileys → Fila `whatsapp.messages.updates`
4. **Eventos**: WhatsApp → Baileys → Fila `whatsapp.events`

## Filas Automáticas

O sistema cria automaticamente as seguintes filas:

- `whatsapp.messages.incoming` - Mensagens recebidas do WhatsApp
- `whatsapp.messages.outgoing` - Mensagens enviadas via API
- `whatsapp.messages.updates` - Atualizações de status das mensagens
- `whatsapp.events` - Eventos de conexão e outros

## Endpoints Principais

### 1. Status do WhatsApp
```bash
GET /api/whatsapp/status
```

**Resposta:**
```json
{
  "success": true,
  "whatsAppConnected": true,
  "rabbitMQConnected": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 2. Enviar Mensagem WhatsApp
```bash
POST /api/messages/whatsapp/send
Content-Type: application/json

{
  "to": "5511999999999@s.whatsapp.net",
  "content": "Olá! Esta é uma mensagem de teste.",
  "type": "text"
}
```

**Tipos de Mensagem Suportados:**
- `text` - Mensagem de texto
- `image` - Imagem (URL)
- `document` - Documento (URL)

### 3. Status das Filas WhatsApp
```bash
GET /api/whatsapp/queues
```

**Resposta:**
```json
{
  "success": true,
  "queues": [
    {
      "name": "whatsapp.messages.incoming",
      "messageCount": 5,
      "consumerCount": 0,
      "isActive": true
    },
    {
      "name": "whatsapp.messages.outgoing",
      "messageCount": 2,
      "consumerCount": 0,
      "isActive": true
    }
  ],
  "whatsAppStatus": "connected",
  "rabbitMQStatus": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 4. Receber Mensagens de Fila
```bash
GET /api/messages/receive/whatsapp.messages.incoming?limit=10&timeout=5
```

## Exemplos de Uso

### 1. Configuração Inicial

```bash
# 1. Iniciar a aplicação
docker-compose up -d

# 2. Verificar status
curl -X GET http://localhost:3000/api/whatsapp/status

# 3. Aguardar QR Code aparecer no terminal
# 4. Escanear QR Code com WhatsApp
# 5. Verificar conexão
curl -X GET http://localhost:3000/api/whatsapp/status
```

### 2. Enviar Mensagem WhatsApp

```bash
curl -X POST http://localhost:3000/api/messages/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999@s.whatsapp.net",
    "content": "Teste de integração Baileys + RabbitMQ",
    "type": "text"
  }'
```

### 3. Monitorar Mensagens Recebidas

```bash
# Verificar mensagens na fila de entrada
curl -X GET "http://localhost:3000/api/messages/receive/whatsapp.messages.incoming?limit=5&timeout=10"

# Verificar mensagens enviadas
curl -X GET "http://localhost:3000/api/messages/receive/whatsapp.messages.outgoing?limit=5&timeout=10"
```

### 4. Processamento Assíncrono

```bash
# Enviar mensagem para processamento
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "queue": "message_processing",
    "message": {
      "id": "msg_123",
      "content": "Mensagem para processamento",
      "timestamp": "2024-01-15T10:30:00Z",
      "metadata": {
        "sender": "whatsapp",
        "priority": "high"
      }
    }
  }'

# Consumir mensagens processadas
curl -X GET "http://localhost:3000/api/messages/receive/message_processing?limit=10&timeout=5"
```

## Estrutura das Mensagens

### Mensagem Recebida do WhatsApp
```json
{
  "id": "3EB0C767D82B6A939B6E",
  "content": "Olá! Como você está?",
  "timestamp": "2024-01-15T10:30:00Z",
  "metadata": {
    "sender": "whatsapp",
    "messageType": "conversation",
    "isGroup": false
  },
  "source": "whatsapp",
  "from": "5511999999999@s.whatsapp.net"
}
```

### Mensagem Enviada via API
```json
{
  "id": "3EB0C767D82B6A939B6E",
  "content": "Resposta automática",
  "timestamp": "2024-01-15T10:30:05Z",
  "metadata": {
    "sender": "api",
    "messageType": "text"
  },
  "source": "whatsapp",
  "to": "5511999999999@s.whatsapp.net",
  "type": "text"
}
```

## Monitoramento

### Health Check Completo
```bash
curl -X GET http://localhost:3000/api/queues/health
```

### Logs em Tempo Real
```bash
docker-compose logs -f app
```

### RabbitMQ Management UI
- URL: http://localhost:15692
- Usuário: guest
- Senha: guest

## Troubleshooting

### WhatsApp Não Conecta
1. Verifique se o QR Code apareceu no terminal
2. Aguarde alguns segundos após escanear
3. Verifique logs: `docker-compose logs app`

### RabbitMQ Não Conecta
1. Verifique se o container está rodando: `docker-compose ps`
2. Verifique logs: `docker-compose logs rabbitmq`
3. Aguarde o healthcheck completar

### Mensagens Não Chegam
1. Verifique status: `GET /api/whatsapp/status`
2. Verifique filas: `GET /api/whatsapp/queues`
3. Verifique logs para erros

## Desenvolvimento

### Adicionar Novos Tipos de Mensagem

Para adicionar suporte a novos tipos de mensagem, edite o método `sendWhatsAppMessage` em `baileysService.js`:

```javascript
async sendWhatsAppMessage(to, content, type = 'text') {
  // ... código existente ...
  
  let message;
  if (type === 'text') {
    message = { text: content };
  } else if (type === 'image') {
    message = { image: { url: content } };
  } else if (type === 'document') {
    message = { document: { url: content } };
  } else if (type === 'audio') {
    message = { audio: { url: content } };
  } else if (type === 'video') {
    message = { video: { url: content } };
  } else {
    throw new Error(`Unsupported message type: ${type}`);
  }
  
  // ... resto do código ...
}
```

### Adicionar Novos Eventos

Para capturar novos eventos do WhatsApp, adicione listeners em `initializeWhatsApp`:

```javascript
this.sock.ev.on('presence.update', async (presence) => {
  await this.sendToQueue('whatsapp.presence', {
    type: 'presence_update',
    data: presence,
    timestamp: new Date().toISOString()
  });
});
```

## Segurança

- As sessões do WhatsApp são salvas localmente em `./sessions`
- Use variáveis de ambiente para credenciais sensíveis
- Implemente autenticação JWT para endpoints sensíveis
- Use HTTPS em produção

## Performance

- O sistema suporta múltiplas conexões simultâneas
- Mensagens são persistidas no RabbitMQ
- Implemente rate limiting para evitar spam
- Use clusters para alta disponibilidade 