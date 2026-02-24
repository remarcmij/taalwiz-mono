import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesizer } from '../useSpeechSynthesizer.ts';

vi.mock('../../lib/logger.ts', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

function createMockVoice(lang: string): SpeechSynthesisVoice {
  return {
    lang,
    name: `Voice ${lang}`,
    default: false,
    localService: true,
    voiceURI: `voice-${lang}`,
  };
}

describe('useSpeechSynthesizer', () => {
  let mockVoices: SpeechSynthesisVoice[];
  let mockSpeak: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockVoices = [createMockVoice('id-ID'), createMockVoice('nl-NL')];
    mockSpeak = vi.fn();
    mockCancel = vi.fn();

    vi.stubGlobal('speechSynthesis', {
      getVoices: () => mockVoices,
      speak: mockSpeak,
      cancel: mockCancel,
    });

    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text = '';
        voice: SpeechSynthesisVoice | null = null;
        lang = '';
        rate = 1;
        private handlers: Record<string, ((e: unknown) => void)[]> = {};
        addEventListener(event: string, handler: (e: unknown) => void) {
          if (!this.handlers[event]) this.handlers[event] = [];
          this.handlers[event]!.push(handler);
        }
        // Trigger for tests
        _fire(event: string) {
          this.handlers[event]?.forEach((h) => h({}));
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ready becomes true after voices load', () => {
    const { result } = renderHook(() => useSpeechSynthesizer());
    expect(result.current.ready).toBe(true);
  });

  it('canSpeak returns true for matching language', () => {
    const { result } = renderHook(() => useSpeechSynthesizer());
    expect(result.current.canSpeak('id')).toBe(true);
  });

  it('canSpeak returns false for non-matching language', () => {
    const { result } = renderHook(() => useSpeechSynthesizer());
    expect(result.current.canSpeak('fr')).toBe(false);
  });

  it('selectVoice returns voice for matching language', () => {
    const { result } = renderHook(() => useSpeechSynthesizer());
    const voice = result.current.selectVoice('nl');
    expect(voice).toBeDefined();
    expect(voice!.lang).toBe('nl-NL');
  });

  it('selectVoice returns undefined for non-matching language', () => {
    const { result } = renderHook(() => useSpeechSynthesizer());
    expect(result.current.selectVoice('fr')).toBeUndefined();
  });

  it('cancel delegates to speechSynthesis.cancel', () => {
    const { result } = renderHook(() => useSpeechSynthesizer());
    act(() => result.current.cancel());
    expect(mockCancel).toHaveBeenCalled();
  });

  it('speakSingle creates utterance and calls speak', async () => {
    mockSpeak.mockImplementation((utterance: { _fire: (e: string) => void }) => {
      // Simulate end event
      setTimeout(() => utterance._fire('end'), 0);
    });

    const { result } = renderHook(() => useSpeechSynthesizer());
    await act(async () => {
      await result.current.speakSingle('halo', 'id', 0.9);
    });

    expect(mockSpeak).toHaveBeenCalled();
  });

  it('gracefully handles speechSynthesis unavailable', () => {
    vi.unstubAllGlobals();
    // Delete speechSynthesis from window so `'speechSynthesis' in window` is false
    const descriptor = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
    delete (window as unknown as Record<string, unknown>)['speechSynthesis'];

    const { result } = renderHook(() => useSpeechSynthesizer());
    expect(result.current.ready).toBe(false);

    // Restore
    if (descriptor) {
      Object.defineProperty(window, 'speechSynthesis', descriptor);
    }
  });
});
