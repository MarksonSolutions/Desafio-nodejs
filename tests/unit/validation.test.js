const Joi = require('joi');

const messageSchema = Joi.object({
  queue: Joi.string().required(),
  message: Joi.object({
    id: Joi.string().required(),
    content: Joi.string().required(),
    timestamp: Joi.string().isoDate().optional(),
    metadata: Joi.object().optional()
  }).required()
});

describe('Message Validation', () => {
  test('should validate correct message format', () => {
    const validMessage = {
      queue: 'test-queue',
      message: {
        id: 'msg-123',
        content: 'Test message',
        timestamp: '2024-01-15T10:30:00Z',
        metadata: {
          sender: 'test-service',
          priority: 'high'
        }
      }
    };

    const { error } = messageSchema.validate(validMessage);
    expect(error).toBeUndefined();
  });

  test('should reject message without queue', () => {
    const invalidMessage = {
      message: {
        id: 'msg-123',
        content: 'Test message'
      }
    };

    const { error } = messageSchema.validate(invalidMessage);
    expect(error).toBeDefined();
  });

  test('should reject message without id', () => {
    const invalidMessage = {
      queue: 'test-queue',
      message: {
        content: 'Test message'
      }
    };

    const { error } = messageSchema.validate(invalidMessage);
    expect(error).toBeDefined();
  });
}); 