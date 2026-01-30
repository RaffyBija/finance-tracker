/**
 * Hook per gestire conferma eliminazione con messaggio personalizzabile
 */
export function useDeleteConfirm() {
  const confirmDelete = (
    message: string = 'Sei sicuro di voler eliminare questo elemento?'
  ): boolean => {
    return window.confirm(message);
  };

  return { confirmDelete };
}
