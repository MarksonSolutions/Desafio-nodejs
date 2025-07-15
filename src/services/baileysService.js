const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const amqp = require('amqplib');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const NodeCache = require('node-cache');

const baileysLogger = {
  level: 'error',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: (msg, ...args) => {
    if (typeof msg === 'string') {
      logger.error(`Baileys: ${msg}`, ...args);
    } else {
      logger.error('Baileys error:', JSON.stringify(msg));
    }
  },
  fatal: (msg, ...args) => {
    if (typeof msg === 'string') {
      logger.error(`Baileys FATAL: ${msg}`, ...args);
    } else {
      logger.error('Baileys FATAL error:', JSON.stringify(msg));
    }
  },
  child: function () { return this; }
};

class BaileysService {
  constructor() {
    this.sock = null;
    this.rabbitMQConnection = null;
    this.rabbitMQChannel = null;
    this.isConnected = false;
    this.isWhatsAppConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
    this.sessionPath = process.env.BAILEYS_SESSION_PATH || './sessions';
    this.myJid = null;
    this.myLid = null;
    this.qrCode = null;
    this.status = 'DISCONNECTED';
    this.retries = 0;
    this.maxQrRetries = 3;
  }

  async initialize() {
    try {
      await this.initializeRabbitMQ();
      await this.initializeWhatsApp();
      this.isConnected = true;
      logger.info('Baileys service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Baileys service:', error);
      throw error;
    }
  }

  async initializeRabbitMQ() {
    try {
      const connectionString = `amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASS || 'guest'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}${process.env.RABBITMQ_VHOST || '/'}`;
      
      this.rabbitMQConnection = await amqp.connect(connectionString);
      this.rabbitMQChannel = await this.rabbitMQConnection.createChannel();

      this.rabbitMQConnection.on('error', (error) => {
        logger.error('RabbitMQ connection error:', error);
        this.handleRabbitMQReconnection();
      });

      this.rabbitMQConnection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.handleRabbitMQReconnection();
      });

      logger.info('RabbitMQ connection established');
    } catch (error) {
      logger.error('Failed to initialize RabbitMQ:', error);
      throw error;
    }
  }

  async initializeWhatsApp() {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

      const store = new NodeCache({
        stdTTL: 120,
        checkperiod: 30,
        useClones: false
      });

      const msgRetryCounterCache = new NodeCache();
      const userDevicesCache = new NodeCache();

      const appName = process.env.APP_NAME || 'Baileys API';
      const appVersion = process.env.APP_VERSION || '1.0.0';
      const clientName = `${appName} ${appVersion}`;

      this.sock = makeWASocket({
        logger: baileysLogger,
        printQRInTerminal: false,
        emitOwnEvents: false,
        markOnlineOnConnect: false,
        browser: [clientName, 'Desktop', appVersion],
        auth: state,
        version: [2, 2323, 4],
        defaultQueryTimeoutMs: 60000,
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        userDevicesCache,
        shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') || jid?.endsWith('@newsletter'),
        transactionOpts: { maxCommitRetries: 1, delayBetweenTriesMs: 10 }
      });

      this.sock.ev.on('connection.update', async (update) => {
        try {
          const { connection, lastDisconnect, qr } = update;

          logger.info('WhatsApp connection update:', {
            connection,
            lastDisconnect: lastDisconnect?.error?.message,
            hasQr: !!qr
          });

          if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
              logger.info('WhatsApp connection closed, attempting reconnection');
              this.status = 'PENDING';
              this.isWhatsAppConnected = false;
              this.handleWhatsAppReconnection();
            } else {
              logger.info('WhatsApp logged out');
              this.status = 'DISCONNECTED';
              this.isWhatsAppConnected = false;
              this.qrCode = null;
            }

            try {
              await this.sendToQueue('whatsapp.events', {
                type: 'connection.close',
                reason: lastDisconnect?.error?.message || 'Unknown',
                shouldReconnect,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              logger.error('Failed to send connection close event to queue:', error);
            }
          }

          if (connection === 'open') {
            this.isWhatsAppConnected = true;
            this.status = 'CONNECTED';
            this.qrCode = null;
            this.retries = 0;
            
            if (this.sock.user) {
              this.myJid = this.sock.user.id;
              this.myLid = this.sock.user?.lid;
            }

            logger.info('WhatsApp connection opened', {
              myJid: this.myJid,
              myLid: this.myLid,
              userName: this.sock.user?.name
            });

            try {
              await this.sendToQueue('whatsapp.events', {
                type: 'connection.open',
                myJid: this.myJid,
                myLid: this.myLid,
                userName: this.sock.user?.name,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              logger.error('Failed to send connection open event to queue:', error);
            }
          }

          if (qr) {
            if (this.retries >= this.maxQrRetries) {
              logger.error('Max QR code retries reached');
              this.status = 'DISCONNECTED';
              this.qrCode = null;
              this.sock.ev.removeAllListeners('connection.update');
              this.sock.ws.close();
              this.sock = null;
              return;
            }

            this.retries++;
            this.qrCode = qr;
            this.status = 'QRCODE';
            
            logger.info('QR Code generated for WhatsApp connection', {
              retry: this.retries,
              maxRetries: this.maxQrRetries,
              qrCode: qr
            });

            logger.info('=== WHATSAPP QR CODE ===');
            logger.info(`QR Code (Retry ${this.retries}/${this.maxQrRetries}): ${qr}`);
            logger.info('=== END QR CODE ===');

            try {
              await this.sendToQueue('whatsapp.events', {
                type: 'qr.generated',
                qr: qr,
                retry: this.retries,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              logger.error('Failed to send QR event to queue:', error);
            }
          }
        } catch (error) {
          logger.error('Error in connection.update handler:', error);
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('messages.upsert', async (m) => {
        try {
          const message = m.messages[0];
          if (!message.key.fromMe) {
            await this.handleIncomingMessage(message);
          }
        } catch (error) {
          logger.error('Error handling incoming message:', error);
        }
      });

      this.sock.ev.on('messages.update', async (m) => {
        try {
          await this.handleMessageUpdate(m);
        } catch (error) {
          logger.error('Error handling message update:', error);
        }
      });

      this.sock.ev.on('presence.update', async ({ id: remoteJid, presences }) => {
        try {
          if (!presences[remoteJid]?.lastKnownPresence) {
            return;
          }

          await this.sendToQueue('whatsapp.presence', {
            remoteJid,
            presence: presences[remoteJid].lastKnownPresence,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.error('Error handling presence update:', error);
        }
      });

      this.sock.ev.on('groups.upsert', async (groups) => {
        try {
          logger.info('New groups received:', groups.length);
          await this.sendToQueue('whatsapp.groups', {
            type: 'groups.upsert',
            groups: groups.map(g => ({ id: g.id, name: g.subject })),
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.error('Error handling groups upsert:', error);
        }
      });

      logger.info('WhatsApp connection initialized');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp:', error);
      throw error;
    }
  }

  async handleIncomingMessage(message) {
    try {
      const messageData = {
        id: message.key.id,
        from: message.key.remoteJid,
        type: message.message?.conversation ? 'text' : 'media',
        content: message.message?.conversation || 'Media message',
        timestamp: new Date().toISOString(),
        metadata: {
          sender: 'whatsapp',
          messageType: Object.keys(message.message || {})[0],
          isGroup: message.key.remoteJid.endsWith('@g.us'),
          pushName: message.pushName,
          messageTimestamp: message.messageTimestamp
        }
      };

      await this.sendToQueue('whatsapp.messages.incoming', messageData);
      logger.info('Incoming message processed and sent to queue', { 
        messageId: messageData.id,
        from: messageData.from,
        type: messageData.type
      });
    } catch (error) {
      logger.error('Error processing incoming message:', error);
    }
  }

  async handleMessageUpdate(update) {
    try {
      const updateData = {
        id: update.key.id,
        from: update.key.remoteJid,
        updateType: 'message_update',
        timestamp: new Date().toISOString(),
        metadata: {
          sender: 'whatsapp',
          update: update.update
        }
      };

      await this.sendToQueue('whatsapp.messages.updates', updateData);
      logger.info('Message update processed and sent to queue', { messageId: updateData.id });
    } catch (error) {
      logger.error('Error processing message update:', error);
    }
  }

  async sendToQueue(queueName, data) {
    try {
      if (!this.rabbitMQChannel) {
        throw new Error('RabbitMQ channel not available');
      }

      await this.rabbitMQChannel.assertQueue(queueName, { durable: true });

      const messageData = {
        id: data.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: data.content || data,
        timestamp: data.timestamp || new Date().toISOString(),
        metadata: data.metadata || {},
        source: 'whatsapp'
      };

      const success = this.rabbitMQChannel.sendToQueue(queueName, Buffer.from(JSON.stringify(messageData)), {
        persistent: true
      });

      if (!success) {
        throw new Error('Failed to send message to queue');
      }

      logger.info(`Message sent to queue ${queueName}:`, {
        messageId: messageData.id,
        queueName,
        timestamp: messageData.timestamp
      });

      return {
        success: true,
        messageId: messageData.id,
        queueName,
        timestamp: messageData.timestamp
      };

    } catch (error) {
      logger.error(`Failed to send message to queue ${queueName}:`, error);
      throw error;
    }
  }

  async sendWhatsAppMessage(to, content, type = 'text') {
    try {
      if (!this.sock || !this.isWhatsAppConnected) {
        throw new Error('WhatsApp not connected');
      }

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

      const result = await this.sock.sendMessage(to, message);

      const messageData = {
        id: result.key.id,
        to: to,
        content: content,
        type: type,
        timestamp: new Date().toISOString(),
        metadata: {
          sender: 'api',
          messageType: type
        }
      };

      try {
        await this.sendToQueue('whatsapp.messages.outgoing', messageData);
      } catch (queueError) {
        logger.error('Failed to send message to queue:', queueError);
      }

      logger.info('WhatsApp message sent successfully', {
        messageId: result.key.id,
        to: to,
        type: type
      });

      return {
        success: true,
        messageId: result.key.id,
        to: to,
        type: type,
        timestamp: messageData.timestamp
      };

    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async receiveMessages(queueName, limit = 10, timeout = 5000) {
    try {
      if (!this.rabbitMQChannel) {
        throw new Error('RabbitMQ channel not available');
      }

      await this.rabbitMQChannel.assertQueue(queueName, { durable: true });

      const messages = [];

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          resolve({
            success: true,
            messages,
            queueName,
            totalReceived: messages.length
          });
        }, timeout);

        this.rabbitMQChannel.consume(queueName, (msg) => {
          if (msg) {
            try {
              const messageData = JSON.parse(msg.content.toString());
              const receivedMessage = {
                ...messageData,
                receivedAt: new Date().toISOString()
              };

              messages.push(receivedMessage);
              
              this.rabbitMQChannel.ack(msg);

              logger.info(`Message received from queue ${queueName}:`, {
                messageId: messageData.id,
                queueName
              });

              if (messages.length >= limit) {
                clearTimeout(timeoutId);
                resolve({
                  success: true,
                  messages,
                  queueName,
                  totalReceived: messages.length
                });
              }
            } catch (error) {
              logger.error('Error processing message:', error);
              this.rabbitMQChannel.nack(msg);
            }
          }
        });

        this.rabbitMQChannel.on('error', (error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
      });

    } catch (error) {
      logger.error(`Failed to receive messages from queue ${queueName}:`, error);
      throw error;
    }
  }

  async getQueueStatus(queueName) {
    try {
      if (!this.rabbitMQChannel) {
        throw new Error('RabbitMQ channel not available');
      }

      const queueInfo = await this.rabbitMQChannel.checkQueue(queueName);
      
      return {
        name: queueName,
        messageCount: queueInfo.messageCount || 0,
        consumerCount: queueInfo.consumerCount || 0,
        isActive: true
      };

    } catch (error) {
      logger.error(`Failed to get queue status for ${queueName}:`, error);
      return {
        name: queueName,
        messageCount: 0,
        consumerCount: 0,
        isActive: false
      };
    }
  }

  async getAllQueuesStatus() {
    try {
      if (!this.rabbitMQChannel) {
        throw new Error('RabbitMQ channel not available');
      }

      const queueStatuses = [];
      
      const queues = [
        'whatsapp.messages.incoming', 
        'whatsapp.messages.outgoing', 
        'whatsapp.messages.updates', 
        'whatsapp.events',
        'whatsapp.presence',
        'whatsapp.groups'
      ];
      
      for (const queueName of queues) {
        try {
          const status = await this.getQueueStatus(queueName);
          queueStatuses.push(status);
        } catch (error) {
          logger.warn(`Could not get status for queue ${queueName}:`, error);
        }
      }

      return {
        success: true,
        queues: queueStatuses,
        rabbitMQStatus: this.rabbitMQConnection ? 'connected' : 'disconnected',
        whatsAppStatus: this.isWhatsAppConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get all queues status:', error);
      throw error;
    }
  }

  async createQueue(queueName, options = {}) {
    try {
      if (!this.rabbitMQChannel) {
        throw new Error('RabbitMQ channel not available');
      }

      const queueOptions = {
        durable: true,
        autoDelete: false,
        ...options
      };

      await this.rabbitMQChannel.assertQueue(queueName, queueOptions);
      
      logger.info(`Queue created: ${queueName}`);
      
      return {
        success: true,
        queueName,
        message: 'Queue created successfully'
      };

    } catch (error) {
      logger.error(`Failed to create queue ${queueName}:`, error);
      throw error;
    }
  }

  async deleteQueue(queueName, options = {}) {
    try {
      if (!this.rabbitMQChannel) {
        throw new Error('RabbitMQ channel not available');
      }

      const deleteOptions = {
        ifUnused: false,
        ifEmpty: false,
        ...options
      };

      await this.rabbitMQChannel.deleteQueue(queueName, deleteOptions);
      
      logger.info(`Queue deleted: ${queueName}`);
      
      return {
        success: true,
        queueName,
        message: 'Queue deleted successfully'
      };

    } catch (error) {
      logger.error(`Failed to delete queue ${queueName}:`, error);
      throw error;
    }
  }

  async handleRabbitMQReconnection() {
    if (this.connectionRetries >= this.maxRetries) {
      logger.error('Max RabbitMQ reconnection attempts reached');
      return;
    }

    this.connectionRetries++;
    logger.info(`Attempting to reconnect RabbitMQ (${this.connectionRetries}/${this.maxRetries})`);

    setTimeout(async () => {
      try {
        await this.initializeRabbitMQ();
      } catch (error) {
        logger.error('RabbitMQ reconnection failed:', error);
        this.handleRabbitMQReconnection();
      }
    }, this.retryDelay);
  }

  async handleWhatsAppReconnection() {
    logger.info('Attempting to reconnect WhatsApp');
    
    setTimeout(async () => {
      try {
        await this.initializeWhatsApp();
      } catch (error) {
        logger.error('WhatsApp reconnection failed:', error);
        this.handleWhatsAppReconnection();
      }
    }, this.retryDelay);
  }

  getStatus() {
    return {
      whatsAppConnected: this.isWhatsAppConnected,
      rabbitMQConnected: this.rabbitMQConnection ? true : false,
      status: this.status,
      qrCode: this.qrCode,
      myJid: this.myJid,
      myLid: this.myLid,
      retries: this.retries,
      timestamp: new Date().toISOString()
    };
  }

  isConnected() {
    return this.isConnected && this.rabbitMQConnection && this.isWhatsAppConnected;
  }

  async disconnect() {
    try {
      if (this.rabbitMQChannel) {
        await this.rabbitMQChannel.close();
      }
      if (this.rabbitMQConnection) {
        await this.rabbitMQConnection.close();
      }
      if (this.sock) {
        await this.sock.logout();
      }
      this.isConnected = false;
      this.isWhatsAppConnected = false;
      this.status = 'DISCONNECTED';
      this.qrCode = null;
      logger.info('Baileys service disconnected');
    } catch (error) {
      logger.error('Error disconnecting Baileys service:', error);
      throw error;
    }
  }
}

module.exports = new BaileysService(); 