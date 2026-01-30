import { useState } from 'react';

/**
 * Hook generico per gestire apertura/chiusura modal con editing
 * Riutilizzabile per qualsiasi tipo di entità
 */
export function useFormModal<T>() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);

  const openModal = () => {
    setEditingItem(null);
    setIsOpen(true);
  };

  const openEditModal = (item: T) => {
    setEditingItem(item);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingItem(null);
  };

  return {
    isOpen,
    editingItem,
    openModal,
    openEditModal,
    closeModal,
  };
}
