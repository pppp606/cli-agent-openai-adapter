import { loadConfig, loadServerConfig } from '../config';
import path from 'path';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load default configuration when no environment variables are set', () => {
      delete process.env.ADAPTER_TYPE;
      delete process.env.RUNTIME_DIR;
      delete process.env.TIMEOUT;
      delete process.env.DEBUG;

      const config = loadConfig();

      expect(config.type).toBe('claude-code');
      expect(config.runtimeDir).toContain('runtime');
      expect(config.runtimeDir).toContain('claude-code');
      expect(config.timeout).toBe(30000);
      expect(config.debug).toBe(false);
    });

    it('should load configuration from environment variables', () => {
      process.env.ADAPTER_TYPE = 'claude-code';
      process.env.RUNTIME_DIR = '/custom/runtime';
      process.env.TIMEOUT = '60000';
      process.env.DEBUG = 'true';

      const config = loadConfig();

      expect(config.type).toBe('claude-code');
      expect(config.runtimeDir).toBe('/custom/runtime');
      expect(config.timeout).toBe(60000);
      expect(config.debug).toBe(true);
    });

    it('should handle invalid timeout gracefully', () => {
      process.env.TIMEOUT = 'invalid';

      const config = loadConfig();

      expect(config.timeout).toBeNaN();
    });

    it('should treat DEBUG as false when not "true"', () => {
      process.env.DEBUG = 'false';
      let config = loadConfig();
      expect(config.debug).toBe(false);

      process.env.DEBUG = '1';
      config = loadConfig();
      expect(config.debug).toBe(false);

      delete process.env.DEBUG;
      config = loadConfig();
      expect(config.debug).toBe(false);
    });
  });

  describe('loadServerConfig', () => {
    it('should load default server configuration when no environment variables are set', () => {
      delete process.env.PORT;
      delete process.env.HOST;

      const config = loadServerConfig();

      expect(config.port).toBe(8000);
      expect(config.host).toBe('localhost');
    });

    it('should load server configuration from environment variables', () => {
      process.env.PORT = '9000';
      process.env.HOST = '0.0.0.0';

      const config = loadServerConfig();

      expect(config.port).toBe(9000);
      expect(config.host).toBe('0.0.0.0');
    });

    it('should handle invalid port gracefully', () => {
      process.env.PORT = 'invalid';

      const config = loadServerConfig();

      expect(config.port).toBeNaN();
    });
  });
});
