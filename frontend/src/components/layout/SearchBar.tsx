interface SearchBarProps {
  setSearchFilter: (value: string) => void;
}

export default function SearchBar({ setSearchFilter }: SearchBarProps) {
  return (
    <input
      type="search"
      className="form-search"
      placeholder="Cerca..."
      aria-label="Cerca transazioni"
      onChange={(e) => setSearchFilter(e.target.value)}
    />
  );
}
