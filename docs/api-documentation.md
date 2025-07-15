# API Documentation - Baileys Message Gateway

## Base URL
```
http://localhost:3000
```

## Authentication
Currently, no authentication is required for the API endpoints.

## Endpoints

### Health Check

#### GET /health
Returns the health status of the API.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "service": "baileys-api",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 443.257017086,
  "memory": {
    "rss": 83509248,
    "heapTotal": 30666752,
    "heapUsed": 28574840,
    "external": 3551292,
    "arrayBuffers": 157434
  },
  "environment": "development"
}
```

#### GET /api/health
Simple health check endpoint.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "service": "baileys-api",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Messages

#### POST /api/messages/send
Send a message to a specific queue.

**Request Body:**
```json
{
  "queue": "orders",
  "message": {
    "id": "unique_message_id",
    "content": "conteúdo da mensagem",
    "timestamp": "2024-01-15T10:30:00Z",
    "metadata": {
      "sender": "service_name",
      "priority": "high"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "unique_message_id",
  "queueName": "orders",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Queue name and message are required"
}
```

#### GET /api/messages/receive/:queueName
Receive messages from a specific queue.

**Parameters:**
- `queueName` (path): Name of the queue
- `limit` (query): Maximum number of messages to receive (default: 10, max: 100)
- `timeout` (query): Timeout in seconds (default: 5, max: 60)

**Example:**
```
GET /api/messages/receive/orders?limit=5&timeout=10
```

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "unique_message_id",
      "content": "conteúdo da mensagem",
      "timestamp": "2024-01-15T10:30:00Z",
      "metadata": {
        "sender": "service_name",
        "priority": "high"
      },
      "receivedAt": "2024-01-15T10:30:05Z"
    }
  ],
  "queueName": "orders",
  "totalReceived": 1
}
```

#### GET /api/messages/:messageId/status
Get the status of a specific message.

**Parameters:**
- `messageId` (path): ID of the message

**Response:**
```json
{
  "success": true,
  "messageId": "unique_message_id",
  "status": "Message status endpoint - to be implemented",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### DELETE /api/messages/:messageId
Delete a specific message.

**Parameters:**
- `messageId` (path): ID of the message

**Response:**
```json
{
  "success": true,
  "messageId": "unique_message_id",
  "message": "Message deleted successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Queues

#### GET /api/queues/status
Get status of all queues.

**Response:**
```json
{
  "success": true,
  "queues": [
    {
      "name": "test_queue_status",
      "messageCount": 0,
      "consumerCount": 0,
      "isActive": true
    }
  ],
  "rabbitMQStatus": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### GET /api/queues/:queueName/status
Get status of a specific queue.

**Parameters:**
- `queueName` (path): Name of the queue

**Response:**
```json
{
  "success": true,
  "queue": {
    "name": "orders",
    "messageCount": 0,
    "consumerCount": 1,
    "isActive": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### POST /api/queues/:queueName
Create a new queue.

**Parameters:**
- `queueName` (path): Name of the queue

**Request Body (optional):**
```json
{
  "durable": true,
  "autoDelete": false
}
```

**Response:**
```json
{
  "success": true,
  "queueName": "orders",
  "message": "Queue created successfully"
}
```

#### DELETE /api/queues/:queueName
Delete a queue.

**Parameters:**
- `queueName` (path): Name of the queue

**Response:**
```json
{
  "success": true,
  "queueName": "orders",
  "message": "Queue deleted successfully"
}
```

#### POST /api/queues/:queueName/purge
Purge all messages from a queue.

**Parameters:**
- `queueName` (path): Name of the queue

**Response:**
```json
{
  "success": true,
  "queueName": "orders",
  "message": "Queue purged successfully"
}
```

#### GET /api/queues/:queueName/messages
Get messages from a queue without consuming them.

**Parameters:**
- `queueName` (path): Name of the queue
- `limit` (query): Maximum number of messages (default: 10, max: 100)

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "unique_message_id",
      "content": "conteúdo da mensagem",
      "timestamp": "2024-01-15T10:30:00Z",
      "metadata": {
        "sender": "service_name",
        "priority": "high"
      }
    }
  ],
  "queueName": "orders",
  "totalMessages": 1
}
```

#### GET /api/queues/health
Get health status of queue system.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "rabbitMQStatus": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Queue name and message are required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Not Found - /api/invalid-endpoint"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to send message",
  "details": "Connection refused to RabbitMQ"
}
```

### 503 Service Unavailable
```json
{
  "success": false,
  "error": "Message service not available"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **Window**: 15 minutes
- **Max Requests**: 100 per IP address
- **Headers**: Rate limit information is included in response headers

## Examples

### Send a Message
```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "queue": "orders",
    "message": {
      "id": "order_123",
      "content": "Nova ordem de compra",
      "timestamp": "2024-01-15T10:30:00Z",
      "metadata": {
        "sender": "order_service",
        "priority": "high"
      }
    }
  }'
```

### Receive Messages
```bash
curl -X GET "http://localhost:3000/api/messages/receive/orders?limit=5&timeout=10"
```

### Check Queue Status
```bash
curl -X GET http://localhost:3000/api/queues/orders/status
```

### Create Queue
```bash
curl -X POST http://localhost:3000/api/queues/orders
```

### Delete Queue
```bash
curl -X DELETE http://localhost:3000/api/queues/orders
```

## Notes

- All timestamps are in ISO 8601 format
- Message IDs must be unique
- Queues are created automatically if they don't exist
- The API supports both Baileys and RabbitMQ as message brokers
- Health checks are available at `/health` and `/api/health`
