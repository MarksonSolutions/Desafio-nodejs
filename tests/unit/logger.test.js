const logger = require('../../src/utils/logger');

describe('Logger', () => {
  test('should have required methods', () => {
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  test('should have child method', () => {
    expect(logger.child).toBeDefined();
    expect(typeof logger.child).toBe('function');
  });

  test('should create child logger', () => {
    const childLogger = logger.child({ component: 'test' });
    expect(childLogger).toBeDefined();
    expect(childLogger.info).toBeDefined();
    expect(childLogger.child).toBeDefined();
  });
}); 