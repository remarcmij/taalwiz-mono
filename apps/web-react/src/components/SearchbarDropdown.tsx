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
    <div className="dropdown-anchor" style={{ position: 'relative' }}>
      <div
        className="dropdown-list"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          maxWidth: 576,
          margin: '0 auto',
          zIndex: 1000,
          backgroundColor: '#fff',
          boxShadow:
            '0 1px 5px 0 rgba(0,0,0,0.2), 0 2px 2px 0 rgba(0,0,0,0.14), 0 3px 1px -2px rgba(0,0,0,0.12)',
          borderRadius: 2,
        }}
      >
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
