const fs = require('fs');

let code = fs.readFileSync('src/components/shared/OrderModal.tsx', 'utf8');

// Imports
code = code.replace(
  /import { DbOrder } from '\.\.\/\.\.\/types';/,
  "import { DbOrder, OrderData } from '../../types';\nimport { useAppStore } from '../../store/index';"
);

// Add state to the component
code = code.replace(
  /export const OrderModal: React\.FC\<OrderModalProps\> = \(\{ order, onClose \}\) => {/,
  `export const OrderModal: React.FC<OrderModalProps> = ({ order, onClose }) => {
  const [isEditing, setIsEditing] = React.useState(order.status === 'POR_VALIDAR');
  const [draft, setDraft] = React.useState<OrderData>(order.order);
  const { updateFullOrder } = useAppStore();
  const [saving, setSaving] = React.useState(false);

  const handleSaveAndSend = async () => {
    setSaving(true);
    await updateFullOrder(order.id, draft, 'PENDIENTE_CXC');
    setSaving(false);
    onClose();
  };`
);

// Modify PlanillaForm usage
code = code.replace(
  /\<div className="min-w-\[720px\] pointer-events-none"\>[\s\S]*?\<PlanillaForm value=\{order\.order\} onChange=\{\(\) => \{\}\} nextNumero=\{order\.order\.numero_pedido \|\| ''\} \/\>[\s\S]*?\<\/div\>/,
  `<div className={\`min-w-[720px] \${!isEditing ? 'pointer-events-none' : ''}\`}>
     <PlanillaForm value={draft} onChange={setDraft} nextNumero={order.order.numero_pedido || ''} />
  </div>`
);

// Add the action buttons at the bottom if POR_VALIDAR
code = code.replace(
  /(\<\/div\>\s*\<\/div\>\s*\<\/div\>\s*\<\/div\>\s*)$/,
  `        {isEditing && (
           <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end gap-3">
             <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">
               Cancelar
             </button>
             <button disabled={saving} onClick={handleSaveAndSend} className="px-6 py-2.5 rounded-xl font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2">
               {saving ? 'Enviando...' : 'Guardar y Enviar a CxC'}
             </button>
           </div>
        )}
$1`
);

fs.writeFileSync('src/components/shared/OrderModal.tsx', code, 'utf8');
console.log('OrderModal updated');
