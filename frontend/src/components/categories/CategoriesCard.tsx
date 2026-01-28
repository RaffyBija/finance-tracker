import type {Category} from '../../types/index'
import {Trash2, Pencil } from 'lucide-react';

interface CategoriesCardProps{
    category : Category,
    handleEdit: (category:Category) => void,
    handleDelete: (id:string) => void,
}

export default function CategoriesCard({
    category,
    handleEdit,
    handleDelete,
}:CategoriesCardProps){

  return (
    <div className="category-card card-border-left" style={{ borderLeftColor: category.color }}>
      <div className="category-card-main">
        <div className="category-card-content">
          <div
            className="category-card-icon"
            style={{ backgroundColor: `${category.color}20` }}
          >
            {category.icon}
          </div>
          <div>
            <h3 className="category-card-title">{category.name}</h3>
            <span className={category.type === 'INCOME' ? 'badge-income' : 'badge-expense'}>
              {category.type === 'INCOME' ? 'Entrata' : 'Uscita'}
            </span>
          </div>
        </div>
        <div className="category-card-actions">
          <button
            onClick={() => handleEdit(category)}
            className="btn-icon-primary"
          >
            <Pencil className="icon-sm" />
          </button>
          <button
            onClick={() => handleDelete(category.id)}
            className="btn-icon-danger"
          >
            <Trash2 className="icon-sm" />
          </button>
        </div>
      </div>
      <div className="category-card-footer">
        {category._count?.transactions || 0} transazioni
      </div>
    </div>
  );
}