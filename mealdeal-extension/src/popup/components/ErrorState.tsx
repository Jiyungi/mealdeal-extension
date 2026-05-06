type Props = {
  message: string;
  onRetry: () => void;
};

export default function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="error-state" role="alert">
      <div className="error-state__title">Something went wrong</div>
      <div className="error-state__message">{message}</div>
      <button className="btn btn--secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
