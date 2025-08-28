import React from 'react';
import { Button } from '../../../components/ui';

export interface AdminServiceAccount {
  id: string;
  password: string;
  end_date: string;
  is_active: boolean;
}

export interface AdminServiceItem {
  name: string;
  image: string;
  accounts: AdminServiceAccount[];
}

interface AdminServiceCardProps {
  service: AdminServiceItem;
  onEdit: () => void;
  onOpenCredits: () => Promise<void> | void;
  onDelete: () => void;
  editingCreditsOpen: boolean;
  creditsForm: Record<string, number>;
  onChangeCredit: (key: string, value: number) => void;
  durations: Record<string, { name: string; days: number; credits_cost: number }>;
  defaultDurationCredits: Record<string, number>;
  onSaveCredits: () => Promise<void> | void;
  onCancelCredits: () => void;
}

const AdminServiceCard: React.FC<AdminServiceCardProps> = ({
  service,
  onEdit,
  onOpenCredits,
  onDelete,
  editingCreditsOpen,
  creditsForm,
  onChangeCredit,
  durations,
  defaultDurationCredits,
  onSaveCredits,
  onCancelCredits,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-4 mb-4">
        <img src={service.image} alt={service.name} className="w-24 h-16 rounded-lg object-cover bg-[ghostwhite]" />
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{service.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{service.accounts.length} accounts</p>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        {service.accounts.map((account, index) => (
          <div key={index} className="text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-gray-600 dark:text-gray-400 break-words">
              <span className="font-medium">ID:</span> {account.id}
            </span>
            <span
              className={`self-start sm:self-auto inline-block px-2 py-0.5 rounded text-[10px] sm:text-xs ${
                account.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {account.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>
      <div className="flex space-x-2">
        <Button onClick={onEdit} variant="primary" size="sm" className="flex-1">
          Edit
        </Button>
        <Button onClick={onOpenCredits} variant="secondary" size="sm" className="flex-1">
          Edit Credits
        </Button>
        <Button onClick={onDelete} variant="secondary" size="sm" className="flex-1">
          Delete
        </Button>
      </div>
      {editingCreditsOpen && (
        <div className="mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Edit Credits</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(durations).map(([key, d]) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-xs w-24 text-gray-700 dark:text-gray-300">{d.name}</label>
                <input
                  type="number"
                  value={creditsForm[key] ?? (defaultDurationCredits[key] ?? d.credits_cost)}
                  onChange={(e) => onChangeCredit(key, Number(e.target.value))}
                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-xs"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={onSaveCredits} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs">
              Save
            </button>
            <button onClick={onCancelCredits} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminServiceCard;


