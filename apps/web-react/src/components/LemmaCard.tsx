import { useCallback } from 'react';
import { convertMarkdown } from '../lib/markdown.ts';
import type { ILemma } from '../types/models.ts';

interface LemmaCardProps {
  lemmas: ILemma[];
  onClicked?: (event: React.MouseEvent) => void;
}

const LemmaCard: React.FC<LemmaCardProps> = ({ lemmas, onClicked }) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'SPAN') {
        onClicked?.(e);
      }
    },
    [onClicked],
  );

  return (
    <div onClick={handleClick} style={{ fontSize: '1rem' }}>
      {lemmas.map((lemma) => (
        <div
          key={lemma._id}
          className="text-content"
          dangerouslySetInnerHTML={{
            __html: convertMarkdown(lemma.text),
          }}
        />
      ))}
    </div>
  );
};

export default LemmaCard;
