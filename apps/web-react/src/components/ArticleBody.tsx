import { useCallback, useEffect, useRef } from 'react';
import { sanitize } from '../lib/sanitize.ts';

interface ArticleBodyProps {
  htmlText: string;
  onClicked?: (event: MouseEvent) => void;
}

const ArticleBody: React.FC<ArticleBodyProps> = ({ htmlText, onClicked }) => {
  const articleRef = useRef<HTMLElement>(null);

  const handleClick = useCallback(
    (event: MouseEvent) => {
      onClicked?.(event);
    },
    [onClicked],
  );

  useEffect(() => {
    const el = articleRef.current;
    if (el) {
      el.addEventListener('click', handleClick);
      return () => el.removeEventListener('click', handleClick);
    }
  }, [handleClick]);

  return (
    <article
      ref={articleRef}
      className="text-content markdown-body ion-padding"
      dangerouslySetInnerHTML={{ __html: sanitize(htmlText) }}
    />
  );
};

export default ArticleBody;
