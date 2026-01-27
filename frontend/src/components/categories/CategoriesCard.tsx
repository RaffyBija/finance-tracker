import type {Category} from '../../types/index'
import {Trash2, Pencil } from 'lucide-react';

import '../../styles/CategorieCard.css'

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
            <div
                key={category.id}
                className="Card-Container"
                style={{ borderLeft: `4px solid ${category.color}` }}
              >
                <div className="Card-MainContent">
                  <div className="Card-DescContent">
                    <div
                      className="Card-IconContent"
                      style={{ backgroundColor: `${category.color}20` }}
                    >
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="Card-TitleContent">{category.name}</h3>
                      <span className={` 
                                rounded ${
                                    category.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`
                            }
                        >
                        {category.type === 'INCOME' ? 'Entrata' : 'Uscita'}
                      </span>
                    </div>
                  </div>
                  <div className="Card-Buttons">
                    <button
                      onClick={() => handleEdit(category)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="Card-Footer">
                  {category._count?.transactions || 0} transazioni
                </div>
              </div>
    );
}
