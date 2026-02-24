import { logger } from '../logger.ts';

describe('logger', () => {
  beforeEach(() => {
    logger.setLevel('silly');
    vi.restoreAllMocks();
  });

  it('setLevel and getLevel work correctly', () => {
    logger.setLevel('warn');
    expect(logger.getLevel()).toBe('warn');
  });

  it('ignores invalid level', () => {
    logger.setLevel('warn');
    logger.setLevel('invalid_level');
    expect(logger.getLevel()).toBe('warn');
  });

  it('isMinLevel returns true for levels at or above threshold', () => {
    logger.setLevel('info');
    expect(logger.isMinLevel('info')).toBe(true);
    expect(logger.isMinLevel('warn')).toBe(true);
    expect(logger.isMinLevel('error')).toBe(true);
  });

  it('isMinLevel returns false for levels below threshold', () => {
    logger.setLevel('info');
    expect(logger.isMinLevel('debug')).toBe(false);
    expect(logger.isMinLevel('silly')).toBe(false);
  });

  it('calls console.warn for warn level', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('test', 'message');
    expect(spy).toHaveBeenCalled();
  });

  it('calls console.info for info level', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('test', 'message');
    expect(spy).toHaveBeenCalled();
  });

  it('calls console.error for error level', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('test', 'message');
    expect(spy).toHaveBeenCalled();
  });

  it('does not log when level is below threshold', () => {
    logger.setLevel('error');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('test', 'message');
    expect(spy).not.toHaveBeenCalled();
  });
});
