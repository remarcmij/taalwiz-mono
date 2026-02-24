import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../ErrorBoundary.tsx';

// Mock Ionic components as simple HTML elements
vi.mock('@ionic/react', () => ({
  IonPage: ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="ion-page" {...props}>
      {children as React.ReactNode}
    </div>
  ),
  IonContent: ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="ion-content" {...props}>
      {children as React.ReactNode}
    </div>
  ),
  IonText: ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="ion-text" {...props}>
      {children as React.ReactNode}
    </div>
  ),
  IonButton: ({
    children,
    onClick,
    ...props
  }: Record<string, unknown>) => (
    <button data-testid="ion-button" onClick={onClick as React.MouseEventHandler} {...props}>
      {children as React.ReactNode}
    </button>
  ),
}));

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Child content</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error from React and ErrorBoundary
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('shows "Something went wrong" when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('An unexpected error occurred.'),
    ).toBeInTheDocument();
  });

  it('calls console.error via componentDidCatch', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(console.error).toHaveBeenCalled();
  });

  it('renders a reload button in error state', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Reload')).toBeInTheDocument();
  });

  it('reload button calls window.location.reload', async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Reload'));

    expect(reloadMock).toHaveBeenCalled();
  });
});
