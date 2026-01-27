type FilterConfig<T> = {
  typeValue?: string;
  itemType?: (item: T) => string;
  searchValue?: string;
  searchFields?: ((item: T) => string | undefined)[];
};

export default function matchesFilters<T>(
  item: T,
  config: FilterConfig<T>
): boolean {
  const {
    typeValue,
    itemType,
    searchValue,
    searchFields = [],
  } = config;

  const matchesType =
    !typeValue ||
    typeValue === 'ALL' ||
    !itemType ||
    itemType(item) === typeValue;

  const matchesSearch =
    !searchValue ||
    searchFields.some((field) =>
      field(item)
        ?.toLowerCase()
        .includes(searchValue.toLowerCase())
    );

  return matchesType && matchesSearch;
}
