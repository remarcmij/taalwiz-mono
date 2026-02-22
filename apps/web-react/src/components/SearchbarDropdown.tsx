import { foreignLang } from '../constants.ts';

interface Suggestion {
  word: string;
  lang: string;
}

interface SearchbarDropdownProps {
  suggestions: Suggestion[];
  visible: boolean;
  onSelect: (word: string, lang: string) => void;
}

const SearchbarDropdown: React.FC<SearchbarDropdownProps> = ({
  suggestions,
  visible,
  onSelect,
}) => {
  if (!visible || suggestions.length === 0) return null;

  return (
    <div className="dropdown-anchor">
      <div className="dropdown-list">
        {suggestions.map((s, i) => (
          <div
            key={i}
            onClick={() => onSelect(s.word, s.lang)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
            }}
            className={
              s.lang === foreignLang ? 'foreign-text' : 'native-text'
            }
          >
            {s.word}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchbarDropdown;
